/**
 * Serviço que guarda o token do Cloudflare da Lumivie e faz, em nome do painel,
 * uma única coisa: ativar um domínio para receber páginas em subdomínio.
 *
 * Existe à parte do painel por causa do token. O painel é uma tela de login
 * aberta na internet; se fosse invadido com o token lá dentro, quem entrasse
 * mexeria no DNS de todos os domínios da conta (site, e-mail). Aqui não há
 * porta publicada e o único pedido aceito é "cria o curinga e o certificado
 * desta zona". Não há rota que apague ou altere registro existente, então o
 * pior que um painel invadido consegue é um curinga a mais.
 *
 * Ativar uma zona:
 *   1. confere que a zona está na conta e com SSL Full ou Full (strict);
 *   2. gera chave e CSR aqui (a chave nunca sai do servidor) e pede ao
 *      Cloudflare um Origin Certificate para *.zona e zona;
 *   3. grava <zona>.pem e <zona>.key na pasta que o nginx lê a cada handshake;
 *   4. cria o registro A *.zona com proxy, apontando para IP_ORIGEM.
 * Se o curinga já existir apontando para cá, reaproveita; se apontar para outro
 * lugar, recusa, porque tomaria os subdomínios de outro serviço.
 *
 * Ativar a raiz (dominio.com.br/<slug>) cria o registro A do próprio domínio,
 * e só quando a raiz não tem A, AAAA nem CNAME: se tiver, já é o site de
 * alguém e não se toca.
 *
 * Variáveis de ambiente:
 *   CF_TOKEN    token do Cloudflare (DNS Edit, SSL and Certificates Edit,
 *               Zone Read, Zone Settings Read), preso ao IP do servidor
 *   IP_ORIGEM   IP para onde o curinga aponta
 *   SEGREDO     segredo partilhado com o painel (cabeçalho X-Segredo)
 *   CERTS       pasta dos certificados das zonas (padrão: /certs)
 *   PRINCIPAL   domínio que nunca é ativado aqui (padrão: lumivie.com.br)
 *   PORTA       padrão 8081
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const TOKEN = process.env.CF_TOKEN || "";
const IP = process.env.IP_ORIGEM || "";
const SEGREDO = process.env.SEGREDO || "";
const CERTS = process.env.CERTS || "/certs";
const PRINCIPAL = process.env.PRINCIPAL || "lumivie.com.br";
const PORTA = Number(process.env.PORTA || 8081);
const API = "https://api.cloudflare.com/client/v4";
const ZONA = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

async function cf(metodo, rota, corpo) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: corpo && JSON.stringify(corpo),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.success) {
    const msg = (j.errors || []).map((e) => e.message).join("; ") || `HTTP ${r.status}`;
    throw Object.assign(new Error(`Cloudflare: ${msg}`), { status: 502 });
  }
  return j;
}

async function zonas() {
  const out = [];
  for (let pagina = 1; ; pagina++) {
    const j = await cf("GET", `/zones?per_page=50&page=${pagina}`);
    out.push(...j.result);
    if (pagina >= (j.result_info?.total_pages || 1)) return out;
  }
}

// O que impede uma zona de ser ativada, em texto para o painel mostrar.
async function problemaDa(z) {
  if (z.name === PRINCIPAL) return "Domínio principal";
  if (z.status !== "active") return "Pendente no Cloudflare";
  const ssl = (await cf("GET", `/zones/${z.id}/settings/ssl`)).result.value;
  // Em Flexible a Cloudflare fala com o servidor por HTTP, e a porta 80 daqui
  // redireciona para HTTPS: o visitante entraria num ciclo de redirecionamento.
  if (ssl !== "full" && ssl !== "strict") return `SSL "${ssl}": mude para Full no Cloudflare`;
  const curinga = (await cf("GET", `/zones/${z.id}/dns_records?name=*.${z.name}`)).result;
  if (curinga.some((r) => r.content !== IP)) return "Já tem curinga de outro serviço";
  return null;
}

const temCertificado = (zona) =>
  fs.existsSync(path.join(CERTS, `${zona}.pem`)) && fs.existsSync(path.join(CERTS, `${zona}.key`));

function escreverAtomico(destino, conteudo, modo) {
  const tmp = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, conteudo, { mode: modo });
  fs.renameSync(tmp, destino);
}

async function certificado(zona) {
  if (temCertificado(zona)) return "certificado já existia";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csr-"));
  try {
    const chave = path.join(dir, "chave.pem");
    const csr = path.join(dir, "pedido.csr");
    execFileSync("openssl", ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", chave, "-subj", `/CN=*.${zona}`, "-out", csr], { stdio: "ignore" });
    const j = await cf("POST", "/certificates", {
      hostnames: [`*.${zona}`, zona],
      requested_validity: 5475,
      request_type: "origin-rsa",
      csr: fs.readFileSync(csr, "utf8"),
    });
    // A chave primeiro: o nginx só procura o par quando existe o .pem, então
    // nunca encontra certificado sem chave.
    // 640 e grupo do nginx (o contentor roda com gid 101): com o certificado
    // escolhido por nome a cada conexão, quem abre a chave é o processo de
    // trabalho do nginx, não o root.
    escreverAtomico(path.join(CERTS, `${zona}.key`), fs.readFileSync(chave), 0o640);
    escreverAtomico(path.join(CERTS, `${zona}.pem`), j.result.certificate, 0o644);
    return `certificado emitido até ${j.result.expires_on.slice(0, 10)}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Registros que fazem a raiz responder por web. MX e TXT (e-mail, SPF) não
// entram: convivem com um A na raiz sem mudar nada.
async function registrosRaiz(z) {
  const r = (await cf("GET", `/zones/${z.id}/dns_records?name=${encodeURIComponent(z.name)}&per_page=100`)).result;
  return r.filter((x) => ["A", "AAAA", "CNAME"].includes(x.type));
}

async function zonaDe(nome) {
  const z = (await cf("GET", `/zones?name=${encodeURIComponent(nome)}`)).result[0];
  if (!z) throw Object.assign(new Error("Domínio não está na conta Cloudflare."), { status: 404 });
  return z;
}

async function ativarRaiz(nome) {
  const z = await zonaDe(nome);
  const problema = await problemaDa(z);
  if (problema) throw Object.assign(new Error(problema), { status: 400 });
  const raiz = await registrosRaiz(z);
  if (raiz.some((r) => r.content !== IP)) {
    throw Object.assign(new Error(`${nome} já aponta para outro servidor. A raiz só é usada quando está livre.`), { status: 400 });
  }
  if (raiz.length) return "raiz já apontava para cá";
  await cf("POST", `/zones/${z.id}/dns_records`, {
    type: "A", name: nome, content: IP, proxied: true, ttl: 1,
    comment: "Painel de paginas Lumivie: sites em dominio/slug",
  });
  console.log(`raiz ativada ${nome}`);
  return "registro da raiz criado";
}

async function ativar(nome) {
  const z = await zonaDe(nome);
  const problema = await problemaDa(z);
  if (problema) throw Object.assign(new Error(problema), { status: 400 });

  const feito = [await certificado(nome)];
  const curinga = (await cf("GET", `/zones/${z.id}/dns_records?name=*.${nome}`)).result;
  if (curinga.length) feito.push("curinga já existia");
  else {
    await cf("POST", `/zones/${z.id}/dns_records`, {
      type: "A", name: `*.${nome}`, content: IP, proxied: true, ttl: 1,
      comment: "Painel de paginas Lumivie: subdominio sem registro proprio cai aqui",
    });
    feito.push("curinga criado");
  }
  console.log(`ativado ${nome}: ${feito.join(", ")}`);
  return feito.join(", ");
}

function responder(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

function autorizado(req) {
  const a = Buffer.from(String(req.headers["x-segredo"] || ""));
  const b = Buffer.from(SEGREDO);
  return SEGREDO.length >= 32 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function tratar(req, res) {
  if (req.method === "GET" && req.url === "/saude") {
    return responder(res, 200, { ok: true, configurado: !!(TOKEN && IP && SEGREDO) });
  }
  if (!autorizado(req)) return responder(res, 403, { erro: "recusado" });

  if (req.method === "GET" && req.url === "/zonas") {
    const lista = [];
    for (const z of await zonas()) {
      const problema = await problemaDa(z);
      const raiz = problema ? [] : await registrosRaiz(z);
      lista.push({
        nome: z.name, problema, certificado: temCertificado(z.name),
        raizLivre: !problema && raiz.every((r) => r.content === IP),
      });
    }
    return responder(res, 200, { zonas: lista.sort((a, b) => a.nome.localeCompare(b.nome)) });
  }

  if (req.method === "POST" && (req.url === "/ativar" || req.url === "/ativar-raiz")) {
    let corpo = "";
    for await (const p of req) {
      corpo += p;
      if (corpo.length > 4096) return responder(res, 413, { erro: "grande" });
    }
    const zona = String(JSON.parse(corpo || "{}").zona || "").toLowerCase();
    if (!ZONA.test(zona) || zona === PRINCIPAL) return responder(res, 400, { erro: "Domínio inválido." });
    const detalhe = req.url === "/ativar" ? await ativar(zona) : await ativarRaiz(zona);
    return responder(res, 200, { ok: true, detalhe });
  }

  return responder(res, 404, { erro: "não encontrado" });
}

fs.mkdirSync(CERTS, { recursive: true });
http
  .createServer((req, res) =>
    tratar(req, res).catch((e) => {
      console.error(e.message);
      if (!res.headersSent) responder(res, e.status || 500, { erro: e.status ? e.message : "Erro no serviço de domínios." });
    }),
  )
  .listen(PORTA, () => console.log(`dns-paginas na porta ${PORTA}`));
