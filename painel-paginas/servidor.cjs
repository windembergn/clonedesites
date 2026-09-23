/**
 * Painel de hospedagem de sites estáticos da Lumivie. Cada site é uma pasta
 * com os arquivos que a pessoa enviar (HTML, CSS, JS, imagens, subpastas) e
 * fica no ar num de dois tipos de endereço:
 *
 *   caminho      <domínio>/<slug>     (lumivie.com.br, ou a raiz de um domínio
 *                                      ativado cuja raiz estava livre)
 *   subdomínio   <slug>.<domínio>     (qualquer domínio ativado)
 *
 * Existe para que quem faz os sites não precise de SSH nem de mexer no nginx
 * ou no DNS: entra com usuário e senha, envia os arquivos e liga ou desliga.
 *
 * Quem serve os sites é o nginx, não este processo. Os arquivos moram em
 * ARQUIVOS/<id>/ e "ligar" um site é criar um link simbólico em PUBLICADO com
 * o nome do endereço, apontando para essa pasta; desligar é apagar o link.
 * Nada é copiado, então ligar, desligar e mudar de endereço são instantâneos,
 * e se este contentor cair os sites continuam no ar.
 *
 * Este processo não guarda token do Cloudflare. Ativar um domínio é pedido ao
 * serviço `dns-paginas` (dns.cjs), que tem o token e só sabe criar o curinga,
 * o registro da raiz e o certificado. Um token de DNS aqui dentro daria a quem
 * invadisse o painel todos os domínios do cliente.
 *
 * Usuários e histórico ficam em DADOS. O histórico é só de acréscimo.
 *
 * Variáveis de ambiente:
 *   PAINEL_USUARIO     primeiro admin, usado só se ainda não houver usuários
 *   PAINEL_SENHA_HASH  senha dele, "scrypt:<sal hex>:<hash hex>" (`node senha.cjs`)
 *   DOMINIO_PRINCIPAL  domínio dos sites por caminho (padrão: lumivie.com.br)
 *   DOMINIOS_SUB       domínios iniciais, separados por vírgula
 *   DNS_URL            endereço interno do serviço dns-paginas (opcional)
 *   DNS_SEGREDO        segredo partilhado com ele
 *   DADOS              índice, usuários e histórico
 *   ARQUIVOS           uma pasta por site
 *   PUBLICADO          links simbólicos por endereço, lidos pelo nginx
 *   SITE               raiz do site principal, só leitura, para evitar slug que
 *                      colida com pasta ou arquivo que já existe lá
 *   PORTA              padrão 8080
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { lerZip, tirarPastaUnica, caminhoSeguro } = require("./zip.cjs");

const PORTA = Number(process.env.PORTA || 8080);
const PREFIXO = "/painel-paginas";
const DADOS = process.env.DADOS || "/dados";
const ARQUIVOS = process.env.ARQUIVOS || "/sites/paginas-arquivos";
const PUBLICADO = process.env.PUBLICADO || "/sites/paginas";
const SITE = process.env.SITE || "/site";
const PRINCIPAL = process.env.DOMINIO_PRINCIPAL || "lumivie.com.br";
const DNS_URL = process.env.DNS_URL || "";
const DNS_SEGREDO = process.env.DNS_SEGREDO || "";

const ARQUIVO_MAX = 50 * 1024 * 1024;
const ZIP_MAX = 100 * 1024 * 1024;
const JSON_MAX = 64 * 1024;
const SESSAO_MS = 12 * 60 * 60 * 1000;
const PREVIA_S = 2 * 60 * 60;
const SITES = path.join(DADOS, "sites.json");
const USUARIOS = path.join(DADOS, "usuarios.json");
const DOMINIOS = path.join(DADOS, "dominios.json");
const HISTORICO = path.join(DADOS, "historico.jsonl");

// Rotas do app React da Lumivie que não são arquivo. O nginx serve o site
// antes do fallback do app, então um site chamado "dashboard" esconderia o
// painel de leads sem dar erro nenhum.
const RESERVADOS = new Set([
  "api", "assets", "img", "fonts", "logos", "link-sp", "link-rs",
  "dashboard", "whatsapp-connect", "paginas-link", "painel-paginas",
  "index", "robots", "sitemap", "llms", "favicon",
]);

// Nomes que um domínio costuma querer para outra coisa (site, e-mail). Mesmo
// que hoje não existam na zona, ocupá-los com um site daria trabalho depois.
const RESERVADOS_SUB = new Set([
  "www", "mail", "webmail", "smtp", "imap", "pop", "ftp", "cpanel", "whm", "webdisk",
  "cpcalendars", "cpcontacts", "ns1", "ns2", "autodiscover", "autoconfig", "api", "app", "admin",
]);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NOME_USUARIO = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const DOMINIO = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const TIPOS = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", json: "application/json",
  map: "application/json", txt: "text/plain; charset=utf-8", xml: "application/xml", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
  otf: "font/otf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", pdf: "application/pdf",
  wasm: "application/wasm", webmanifest: "application/manifest+json",
};
const tipoDe = (nome) => TIPOS[(path.extname(nome).slice(1) || "").toLowerCase()] || "application/octet-stream";

fs.mkdirSync(ARQUIVOS, { recursive: true });
fs.mkdirSync(PUBLICADO, { recursive: true });

// Escrever num temporário e renomear: um rename é atómico, então o nginx nunca
// serve meio arquivo e um corte de energia não deixa um JSON truncado.
function escreverAtomico(destino, conteudo) {
  const tmp = `${destino}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, conteudo);
  fs.renameSync(tmp, destino);
}
const lerJson = (arq, padrao) => {
  try {
    return JSON.parse(fs.readFileSync(arq, "utf8"));
  } catch {
    return padrao;
  }
};
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

/* ---------------------------------------------------------------- histórico */

// Uma linha JSON por ação. appendFileSync com uma linha curta é uma escrita
// só, então duas ações seguidas não se misturam no arquivo.
function registrar(usuario, acao, alvo = "", detalhe = "", ip = "") {
  const linha = { quando: new Date().toISOString(), usuario, acao, alvo, detalhe, ip };
  fs.appendFileSync(HISTORICO, JSON.stringify(linha) + "\n");
  console.log(`${usuario || "-"} ${acao} ${alvo} ${detalhe}`.trim());
}

function lerHistorico({ usuario, limite = 500 }) {
  let linhas = [];
  try {
    linhas = fs.readFileSync(HISTORICO, "utf8").trim().split("\n");
  } catch {}
  const out = [];
  for (let i = linhas.length - 1; i >= 0 && out.length < limite; i--) {
    try {
      const l = JSON.parse(linhas[i]);
      if (!usuario || l.usuario === usuario) out.push(l);
    } catch {}
  }
  return out;
}

/* ----------------------------------------------------------------- usuários */

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  return `scrypt:${sal.toString("hex")}:${crypto.scryptSync(senha, sal, 64).toString("hex")}`;
}
function hashConfere(hash, senha) {
  const [alg, salHex, hashHex] = String(hash).split(":");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtido = crypto.scryptSync(String(senha), Buffer.from(salHex, "hex"), esperado.length);
  return crypto.timingSafeEqual(obtido, esperado);
}
// Usuário inexistente também paga o custo do scrypt, para a demora da resposta
// não dizer se o nome existe.
const HASH_FALSO = hashSenha(crypto.randomBytes(16).toString("hex"));

let usuarios = lerJson(USUARIOS, null);
if (!usuarios) {
  usuarios = {};
  if (process.env.PAINEL_USUARIO && process.env.PAINEL_SENHA_HASH) {
    usuarios[process.env.PAINEL_USUARIO] = {
      hash: process.env.PAINEL_SENHA_HASH, papel: "admin",
      criado: new Date().toISOString(), criadoPor: "instalação",
    };
  }
  escreverAtomico(USUARIOS, JSON.stringify(usuarios, null, 2));
}
const salvarUsuarios = () => escreverAtomico(USUARIOS, JSON.stringify(usuarios, null, 2));
const admins = () => Object.values(usuarios).filter((u) => u.papel === "admin").length;

function motivoSenhaFraca(senha) {
  if (typeof senha !== "string" || senha.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (senha.length > 200) return "Senha longa demais.";
  return null;
}

/* ---------------------------------------------------------------- domínios */

// Domínios ativados: todos aceitam subdomínio; `raiz` diz se o próprio
// domínio também aponta para cá e aceita sites por caminho.
let dominios = lerJson(DOMINIOS, null);
if (!dominios) dominios = (process.env.DOMINIOS_SUB || "").split(",").map((d) => d.trim()).filter(Boolean);
// Versão anterior guardava só os nomes.
dominios = dominios.map((d) => (typeof d === "string" ? { dominio: d, raiz: false } : d));
const salvarDominios = () => escreverAtomico(DOMINIOS, JSON.stringify(dominios, null, 2));
salvarDominios();

const dominioAtivo = (d) => dominios.find((x) => x.dominio === d);
function modoPermitido(modo, dominio) {
  if (modo === "caminho") return dominio === PRINCIPAL || !!dominioAtivo(dominio)?.raiz;
  if (modo === "sub") return !!dominioAtivo(dominio);
  return false;
}
const opcoesEndereco = () => [
  { modo: "caminho", dominio: PRINCIPAL },
  ...dominios.flatMap((d) => [
    { modo: "sub", dominio: d.dominio },
    ...(d.raiz ? [{ modo: "caminho", dominio: d.dominio }] : []),
  ]),
];

async function dns(metodo, rota, corpo) {
  if (!DNS_URL) throw erro(503, "Serviço de domínios não configurado.");
  const r = await fetch(DNS_URL + rota, {
    method: metodo,
    headers: { "Content-Type": "application/json", "X-Segredo": DNS_SEGREDO },
    body: corpo && JSON.stringify(corpo),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw erro(r.status >= 500 ? 502 : r.status, j.erro || "Falha no serviço de domínios.");
  return j;
}

/* --------------------------------------------------------------------- sites */

let sites = lerJson(SITES, {});
const salvarSites = () => escreverAtomico(SITES, JSON.stringify(sites, null, 2));

const endereco = (s) => (s.modo === "sub" ? `${s.slug}.${s.dominio}` : `${s.dominio}/${s.slug}`);
const pastaSite = (id) => path.join(ARQUIVOS, id);
const linkDe = (s) => (s.modo === "sub" ? path.join(PUBLICADO, `${s.slug}.${s.dominio}`) : path.join(PUBLICADO, s.dominio, s.slug));

// O link é relativo para valer igual aqui dentro e no nginx: nos dois, as
// pastas PUBLICADO e ARQUIVOS são irmãs.
function ligarLink(s, id) {
  const link = linkDe(s);
  fs.mkdirSync(path.dirname(link), { recursive: true });
  const tmp = `${link}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.symlinkSync(path.relative(path.dirname(link), pastaSite(id)), tmp);
  fs.renameSync(tmp, link);
}
function desligarLink(s) {
  try {
    if (fs.lstatSync(linkDe(s)).isSymbolicLink()) fs.unlinkSync(linkDe(s));
  } catch {}
}
const publicar = (id) => (sites[id].ativo ? ligarLink(sites[id], id) : desligarLink(sites[id]));

// Ao subir, PUBLICADO passa a refletir o índice: cria o que falta e apaga link
// que não corresponde a site ligado. Arquivos de verdade nunca são apagados.
function sincronizar() {
  const validos = new Set();
  for (const [id, s] of Object.entries(sites)) {
    publicar(id);
    if (s.ativo) validos.add(linkDe(s));
  }
  const varrer = (pasta, fundo) => {
    for (const nome of fs.readdirSync(pasta)) {
      const p = path.join(pasta, nome);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink() && !validos.has(p)) fs.unlinkSync(p);
      else if (st.isDirectory() && fundo === 0) varrer(p, 1);
    }
  };
  varrer(PUBLICADO, 0);
}

// A versão anterior do painel guardava uma página HTML por endereço em
// paginas.json + html/. Cada uma vira um site com esse HTML como index.html.
(function migrarPaginas() {
  const antigo = lerJson(path.join(DADOS, "paginas.json"), null);
  if (!antigo) return;
  for (const [chave, p] of Object.entries(antigo)) {
    const i = chave.indexOf("/");
    const dominio = chave.slice(0, i);
    const slug = chave.slice(i + 1);
    const id = crypto.randomBytes(4).toString("hex");
    fs.mkdirSync(pastaSite(id), { recursive: true });
    try {
      fs.copyFileSync(path.join(DADOS, "html", `${dominio}__${slug}.html`), path.join(pastaSite(id), "index.html"));
    } catch {}
    sites[id] = {
      modo: dominio === PRINCIPAL ? "caminho" : "sub", dominio, slug, ativo: !!p.ativo,
      criado: p.criado, criadoPor: p.criadoPor, atualizado: p.atualizado, atualizadoPor: p.atualizadoPor,
    };
  }
  salvarSites();
  fs.renameSync(path.join(DADOS, "paginas.json"), path.join(DADOS, `paginas.json.migrado-${Date.now()}`));
})();

// O curinga só vale para nomes que a zona não tem. Se o nome já tiver registro
// próprio (outro servidor), o site nunca apareceria, então pergunta-se ao
// próprio endereço: só o nosso nginx responde com a marca.
async function respondeAqui(host) {
  try {
    const r = await fetch(`https://${host}/.painel-paginas`, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    return (await r.text()).trim() === "painel-paginas";
  } catch {
    return false;
  }
}

async function motivoEnderecoInvalido({ modo, dominio, slug }, idAtual) {
  if (!SLUG.test(slug)) return "Use só letras minúsculas, números e hífen (ex.: promo-setembro).";
  if (!modoPermitido(modo, dominio)) return "Esse tipo de endereço não está ativo para esse domínio.";
  const ocupado = Object.entries(sites).find(([id, s]) => id !== idAtual && s.modo === modo && s.dominio === dominio && s.slug === slug);
  if (ocupado) return `Já existe um site em ${endereco(ocupado[1])}.`;
  if (modo === "sub") {
    if (RESERVADOS_SUB.has(slug)) return `"${slug}.${dominio}" fica reservado para o próprio domínio.`;
    if (!(await respondeAqui(`${slug}.${dominio}`))) return `"${slug}.${dominio}" já está em uso por outro serviço.`;
    return null;
  }
  if (dominio === PRINCIPAL) {
    if (RESERVADOS.has(slug)) return `"${slug}" já é usado pelo site da Lumivie.`;
    try {
      const existentes = fs.readdirSync(SITE).map((n) => n.replace(/\.[^.]+$/, "").toLowerCase());
      if (existentes.includes(slug)) return `"${slug}" já é uma pasta ou arquivo do site da Lumivie.`;
    } catch {}
  }
  return null;
}

// Tudo o que mexe em arquivo passa por aqui: o caminho relativo é validado e
// o resultado tem de ficar dentro da pasta do site.
function alvoNoSite(id, rel, permitirRaiz = false) {
  const limpo = caminhoSeguro(rel, { permitirVazio: permitirRaiz });
  const base = pastaSite(id);
  const alvo = path.join(base, limpo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) throw erro(400, "Caminho inválido.");
  return { limpo, alvo };
}

function listarPasta(id, rel) {
  const { limpo, alvo } = alvoNoSite(id, rel, true);
  let nomes;
  try {
    nomes = fs.readdirSync(alvo);
  } catch {
    throw erro(404, "Pasta não existe.");
  }
  const itens = [];
  for (const nome of nomes) {
    if (nome.endsWith(".tmp")) continue;
    const st = fs.lstatSync(path.join(alvo, nome));
    if (st.isSymbolicLink()) continue;
    itens.push({ nome, tipo: st.isDirectory() ? "pasta" : "arquivo", bytes: st.isDirectory() ? null : st.size, modificado: st.mtime.toISOString() });
  }
  itens.sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome, "pt-BR") : a.tipo === "pasta" ? -1 : 1));
  return { pasta: limpo, itens };
}

function tamanhoPasta(p) {
  let total = 0;
  let quantos = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) {
      const r = tamanhoPasta(f);
      total += r.total;
      quantos += r.quantos;
    } else if (e.isFile()) {
      total += fs.statSync(f).size;
      quantos++;
    }
  }
  return { total, quantos };
}

// Todas as pastas do site, para escolher o destino de "Mover para".
function todasAsPastas(id) {
  const base = pastaSite(id);
  const out = [""];
  const andar = (rel) => {
    for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
      if (!e.isDirectory() || out.length >= 2000) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      out.push(r);
      andar(r);
    }
  };
  andar("");
  return out.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function resumoSite(id) {
  const s = sites[id];
  let uso = { total: 0, quantos: 0 };
  try {
    uso = tamanhoPasta(pastaSite(id));
  } catch {}
  let temIndex = false;
  try {
    temIndex = fs.statSync(path.join(pastaSite(id), "index.html")).isFile();
  } catch {}
  return {
    id, modo: s.modo, dominio: s.dominio, slug: s.slug, endereco: endereco(s), url: `https://${endereco(s)}/`,
    ativo: !!s.ativo, criado: s.criado, criadoPor: s.criadoPor, atualizado: s.atualizado, atualizadoPor: s.atualizadoPor,
    bytes: uso.total, arquivos: uso.quantos, temIndex,
  };
}

function tocar(id, eu) {
  sites[id].atualizado = new Date().toISOString();
  sites[id].atualizadoPor = eu;
  salvarSites();
}

const INDEX_INICIAL = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Site em preparação</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0">
<p>Site em preparação.</p>
</body>
</html>
`;

/* ------------------------------------------------------------------- sessão */

const sessoes = new Map();
const tentativas = new Map();

// Cinco erros em quinze minutos travam o IP. Com a Cloudflare na frente, o IP
// real chega no X-Real-IP que o nginx já preenche a partir do CF-Connecting-IP.
function bloqueado(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() > t.ate) return false;
  return t.erros >= 5;
}
function registrarErro(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() > t.ate) tentativas.set(ip, { erros: 1, ate: Date.now() + 15 * 60 * 1000 });
  else t.erros++;
}

// A sessão guarda só o nome. Papel e existência são lidos a cada pedido, então
// remover alguém ou tirar o admin vale na hora, sem esperar a sessão vencer.
function sessaoDe(req) {
  const m = /(?:^|;\s*)painel=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m) return null;
  const s = sessoes.get(m[1]);
  if (!s || Date.now() > s.expira || !usuarios[s.usuario]) {
    sessoes.delete(m[1]);
    return null;
  }
  return { token: m[1], usuario: s.usuario, papel: usuarios[s.usuario].papel };
}

function derrubarSessoes(usuario, exceto) {
  for (const [k, s] of sessoes) if (s.usuario === usuario && k !== exceto) sessoes.delete(k);
}

const cookie = (valor, idade) =>
  `painel=${valor}; Path=${PREFIXO}; HttpOnly; Secure; SameSite=Strict; Max-Age=${idade}`;

// A pré-visualização abre numa aba nova e carrega CSS, JS e imagens por
// caminho relativo; esses pedidos não levam o cookie de forma confiável, então
// a autorização vai no próprio endereço, assinada e com validade.
const SEGREDO_PREVIA = crypto.randomBytes(32);
const assinar = (id, exp) => crypto.createHmac("sha256", SEGREDO_PREVIA).update(`${id}.${exp}`).digest("base64url").slice(0, 32);

/* --------------------------------------------------------------------- HTTP */

const PAINEL = fs.readFileSync(path.join(__dirname, "painel.html"));

function responder(res, status, corpo, cabecalhos = {}) {
  const json = typeof corpo !== "string" && !Buffer.isBuffer(corpo);
  res.writeHead(status, {
    "Content-Type": json ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...cabecalhos,
  });
  res.end(json ? JSON.stringify(corpo) : corpo);
}

function lerBruto(req, max) {
  return new Promise((ok, falha) => {
    const pedacos = [];
    let total = 0;
    req.on("data", (p) => {
      total += p.length;
      if (total > max) {
        falha(erro(413, `Arquivo maior que ${Math.round(max / 1048576)} MB.`));
        req.destroy();
      } else pedacos.push(p);
    });
    req.on("end", () => ok(Buffer.concat(pedacos)));
    req.on("error", falha);
  });
}
async function lerJsonCorpo(req) {
  const b = await lerBruto(req, JSON_MAX);
  try {
    return JSON.parse(b.toString("utf8") || "{}");
  } catch {
    throw erro(400, "Pedido inválido.");
  }
}

// O arquivo é gravado num temporário ao lado e só então renomeado: quem abre o
// site durante o envio vê a versão antiga inteira, nunca a nova pela metade.
function gravarStream(req, destino, max) {
  return new Promise((ok, falha) => {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    const out = fs.createWriteStream(tmp);
    let total = 0;
    let abortado = false;
    const parar = (e) => {
      if (abortado) return;
      abortado = true;
      out.destroy();
      fs.rmSync(tmp, { force: true });
      falha(e);
    };
    req.on("data", (p) => {
      total += p.length;
      if (total > max) {
        parar(erro(413, `Arquivo maior que ${Math.round(max / 1048576)} MB.`));
        req.destroy();
      }
    });
    req.on("error", parar);
    out.on("error", parar);
    out.on("finish", () => {
      if (abortado) return;
      try {
        if (fs.existsSync(destino) && fs.lstatSync(destino).isDirectory()) throw erro(409, "Já existe uma pasta com esse nome.");
        fs.renameSync(tmp, destino);
        ok(total);
      } catch (e) {
        fs.rmSync(tmp, { force: true });
        falha(e);
      }
    });
    req.pipe(out);
  });
}

const resumoUsuario = (nome) => {
  const u = usuarios[nome];
  return { usuario: nome, papel: u.papel, criado: u.criado, criadoPor: u.criadoPor, ultimoAcesso: u.ultimoAcesso };
};

const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function servirPrevia(req, res, rota) {
  const m = /^\/previa\/(\d+)\.([A-Za-z0-9_-]{32})\/([a-f0-9]{8})(\/.*)?$/.exec(rota);
  if (!m) return responder(res, 404, "Não encontrado.");
  const [, exp, sig, id, resto = ""] = m;
  const esperado = assinar(id, exp);
  if (Number(exp) < Date.now() / 1000 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado)) || !sites[id]) {
    return responder(res, 403, "Link de pré-visualização vencido. Abra de novo pelo painel.");
  }
  if (!resto) return responder(res, 301, "", { Location: `${PREFIXO}/previa/${exp}.${sig}/${id}/` });
  let rel;
  try {
    rel = decodeURIComponent(resto);
  } catch {
    return responder(res, 400, "Endereço inválido.");
  }
  let alvo;
  try {
    alvo = alvoNoSite(id, rel, true).alvo;
  } catch {
    return responder(res, 404, "Não encontrado.");
  }
  let st;
  try {
    st = fs.statSync(alvo);
  } catch {
    return responder(res, 404, "Não encontrado.");
  }
  if (st.isDirectory()) {
    if (!rel.endsWith("/")) return responder(res, 301, "", { Location: `${PREFIXO}${rota}/` });
    alvo = path.join(alvo, "index.html");
    if (!fs.existsSync(alvo)) return responder(res, 404, "Esta pasta não tem index.html.");
  }
  // Sandbox sem allow-same-origin: o HTML do site roda com origem opaca e não
  // consegue usar a sessão do painel, mesmo estando no mesmo domínio.
  res.writeHead(200, {
    "Content-Type": tipoDe(alvo),
    "Cache-Control": "no-store",
    "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads",
    "X-Robots-Tag": "noindex",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(alvo).pipe(res);
}

async function tratar(req, res) {
  const url = new URL(req.url, "http://x");
  const rota = url.pathname.startsWith(PREFIXO) ? url.pathname.slice(PREFIXO.length) : null;
  if (rota === null) return responder(res, 404, { erro: "não encontrado" });

  // HEAD também: monitor de uptime e pré-visualização de link usam HEAD, e o
  // Node já descarta o corpo sozinho.
  const leitura = req.method === "GET" || req.method === "HEAD";
  if (leitura && (rota === "/" || rota === "")) return responder(res, 200, PAINEL);
  if (leitura && rota.startsWith("/previa/")) return servirPrevia(req, res, rota);
  if (req.method === "GET" && rota === "/saude") {
    return responder(res, 200, {
      ok: true, usuarios: Object.keys(usuarios).length, admins: admins(),
      sites: Object.keys(sites).length, enderecos: opcoesEndereco(), dns: !!DNS_URL,
    });
  }
  if (!rota.startsWith("/api/")) return responder(res, 404, { erro: "não encontrado" });

  // Um formulário de outro site não consegue pôr cabeçalho próprio sem passar
  // por CORS, que aqui não existe. Junto com SameSite=Strict, fecha o CSRF.
  if (req.method !== "GET" && req.headers["x-painel"] !== "1") {
    return responder(res, 403, { erro: "pedido recusado" });
  }

  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;

  if (req.method === "POST" && rota === "/api/entrar") {
    if (bloqueado(ip)) return responder(res, 429, { erro: "Muitas tentativas. Espere 15 minutos." });
    const corpo = await lerJsonCorpo(req);
    const nome = String(corpo.usuario || "").trim().toLowerCase();
    const u = usuarios[nome];
    if (!hashConfere(u ? u.hash : HASH_FALSO, corpo.senha || "") || !u) {
      registrarErro(ip);
      registrar(nome.slice(0, 40), "login recusado", "", "", ip);
      return responder(res, 401, { erro: "Usuário ou senha incorretos." });
    }
    tentativas.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessoes.set(token, { usuario: nome, expira: Date.now() + SESSAO_MS });
    u.ultimoAcesso = new Date().toISOString();
    salvarUsuarios();
    registrar(nome, "entrou", "", "", ip);
    return responder(res, 200, { ok: true }, { "Set-Cookie": cookie(token, SESSAO_MS / 1000) });
  }

  const s = sessaoDe(req);
  if (rota === "/api/sair" && req.method === "POST") {
    if (s) {
      sessoes.delete(s.token);
      registrar(s.usuario, "saiu", "", "", ip);
    }
    return responder(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  }
  if (!s) return responder(res, 401, { erro: "Sessão expirada. Entre de novo." });
  const eu = s.usuario;
  const admin = s.papel === "admin";
  const soAdmin = () => responder(res, 403, { erro: "Só um administrador pode fazer isso." });

  if (req.method === "GET" && rota === "/api/eu") {
    return responder(res, 200, { usuario: eu, papel: s.papel, dns: !!DNS_URL });
  }

  if (req.method === "POST" && rota === "/api/minha-senha") {
    const { atual, nova } = await lerJsonCorpo(req);
    if (!hashConfere(usuarios[eu].hash, atual || "")) return responder(res, 400, { erro: "A senha atual não confere." });
    const fraca = motivoSenhaFraca(nova);
    if (fraca) return responder(res, 400, { erro: fraca });
    usuarios[eu].hash = hashSenha(nova);
    salvarUsuarios();
    derrubarSessoes(eu, s.token);
    registrar(eu, "trocou a própria senha", eu, "", ip);
    return responder(res, 200, { ok: true });
  }

  /* ---- sites ---- */

  if (rota === "/api/sites") {
    if (req.method === "GET") {
      const lista = Object.keys(sites).map(resumoSite).sort((a, b) => a.endereco.localeCompare(b.endereco));
      return responder(res, 200, { sites: lista, enderecos: opcoesEndereco() });
    }
    if (req.method === "POST") {
      const corpo = await lerJsonCorpo(req);
      const novo = { modo: String(corpo.modo), dominio: String(corpo.dominio), slug: String(corpo.slug || "") };
      const motivo = await motivoEnderecoInvalido(novo);
      if (motivo) return responder(res, 400, { erro: motivo });
      const id = crypto.randomBytes(4).toString("hex");
      fs.mkdirSync(pastaSite(id), { recursive: true });
      fs.writeFileSync(path.join(pastaSite(id), "index.html"), INDEX_INICIAL);
      const agora = new Date().toISOString();
      sites[id] = { ...novo, ativo: !!corpo.ativo, criado: agora, criadoPor: eu, atualizado: agora, atualizadoPor: eu };
      salvarSites();
      publicar(id);
      registrar(eu, "criou site", endereco(sites[id]), sites[id].ativo ? "no ar" : "desligado", ip);
      return responder(res, 200, resumoSite(id));
    }
    return responder(res, 405, { erro: "método não permitido" });
  }

  const ms = /^\/api\/sites\/([a-f0-9]{8})(?:\/([a-z-]+))?$/.exec(rota);
  if (ms) {
    const [, id, acao = ""] = ms;
    if (!sites[id]) return responder(res, 404, { erro: "Site não existe." });
    const site = sites[id];
    const rel = url.searchParams.get("caminho") || "";

    if (!acao && req.method === "GET") return responder(res, 200, resumoSite(id));

    // Liga, desliga ou muda o endereço.
    if (!acao && req.method === "PATCH") {
      const corpo = await lerJsonCorpo(req);
      const antes = { ...site };
      const novo = {
        modo: corpo.modo !== undefined ? String(corpo.modo) : site.modo,
        dominio: corpo.dominio !== undefined ? String(corpo.dominio) : site.dominio,
        slug: corpo.slug !== undefined ? String(corpo.slug) : site.slug,
      };
      const mudouEndereco = novo.modo !== site.modo || novo.dominio !== site.dominio || novo.slug !== site.slug;
      if (mudouEndereco) {
        const motivo = await motivoEnderecoInvalido(novo, id);
        if (motivo) return responder(res, 400, { erro: motivo });
        desligarLink(site);
        Object.assign(site, novo);
      }
      if (corpo.ativo !== undefined) site.ativo = !!corpo.ativo;
      tocar(id, eu);
      publicar(id);
      if (mudouEndereco) registrar(eu, "mudou endereço", endereco(site), `antes: ${endereco(antes)}`, ip);
      if (!!antes.ativo !== site.ativo) registrar(eu, site.ativo ? "ligou site" : "desligou site", endereco(site), "", ip);
      return responder(res, 200, resumoSite(id));
    }

    if (!acao && req.method === "DELETE") {
      desligarLink(site);
      const uso = resumoSite(id);
      fs.rmSync(pastaSite(id), { recursive: true, force: true });
      delete sites[id];
      salvarSites();
      registrar(eu, "apagou site", endereco(site), `${uso.arquivos} arquivos, ${kb(uso.bytes)}`, ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "lista" && req.method === "GET") return responder(res, 200, listarPasta(id, rel));

    if (acao === "arquivo" && req.method === "GET") {
      const { alvo } = alvoNoSite(id, rel);
      let st;
      try {
        st = fs.statSync(alvo);
      } catch {
        return responder(res, 404, { erro: "Arquivo não existe." });
      }
      if (!st.isFile()) return responder(res, 400, { erro: "Não é um arquivo." });
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "Content-Length": st.size });
      return fs.createReadStream(alvo).pipe(res);
    }

    if (acao === "arquivo" && req.method === "PUT") {
      const { limpo, alvo } = alvoNoSite(id, rel);
      const existia = fs.existsSync(alvo);
      const bytes = await gravarStream(req, alvo, ARQUIVO_MAX);
      tocar(id, eu);
      // Envio em lote (pasta, vários arquivos) registra uma linha só no fim,
      // pedida pelo painel em /lote; o histórico não vira uma lista de 300.
      if (!req.headers["x-lote"]) {
        registrar(eu, existia ? "editou arquivo" : "enviou arquivo", `${endereco(site)}/${limpo}`, kb(bytes), ip);
      }
      return responder(res, 200, { ok: true, caminho: limpo, bytes });
    }

    if (acao === "lote" && req.method === "POST") {
      const { quantos, pasta, bytes } = await lerJsonCorpo(req);
      const destino = pasta ? `${endereco(site)}/${caminhoSeguro(pasta, { permitirVazio: true })}` : endereco(site);
      registrar(eu, "enviou arquivos", destino, `${Number(quantos) || 0} arquivos, ${kb(Number(bytes) || 0)}`, ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "zip" && req.method === "POST") {
      const { limpo: pasta, alvo: base } = alvoNoSite(id, rel, true);
      const buf = await lerBruto(req, ZIP_MAX);
      const arquivos = tirarPastaUnica(lerZip(buf));
      if (!arquivos.length) return responder(res, 400, { erro: "O zip está vazio." });
      let bytes = 0;
      for (const a of arquivos) {
        const destino = path.join(base, a.nome);
        if (!destino.startsWith(pastaSite(id) + path.sep)) throw erro(400, "Caminho inválido no zip.");
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        if (fs.existsSync(destino) && fs.lstatSync(destino).isDirectory()) throw erro(409, `"${a.nome}" é uma pasta no site e um arquivo no zip.`);
        escreverAtomico(destino, a.dados);
        bytes += a.dados.length;
      }
      tocar(id, eu);
      registrar(eu, "enviou zip", pasta ? `${endereco(site)}/${pasta}` : endereco(site), `${arquivos.length} arquivos, ${kb(bytes)}`, ip);
      return responder(res, 200, { ok: true, arquivos: arquivos.length, bytes });
    }

    if (acao === "pasta" && req.method === "POST") {
      const { limpo, alvo } = alvoNoSite(id, rel);
      if (fs.existsSync(alvo)) return responder(res, 409, { erro: "Já existe algo com esse nome." });
      fs.mkdirSync(alvo, { recursive: true });
      tocar(id, eu);
      registrar(eu, "criou pasta", `${endereco(site)}/${limpo}`, "", ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "arquivo" && req.method === "DELETE") {
      const { limpo, alvo } = alvoNoSite(id, rel);
      let st;
      try {
        st = fs.lstatSync(alvo);
      } catch {
        return responder(res, 404, { erro: "Não existe." });
      }
      const detalhe = st.isDirectory() ? `pasta, ${tamanhoPasta(alvo).quantos} arquivos` : kb(st.size);
      fs.rmSync(alvo, { recursive: true, force: true });
      tocar(id, eu);
      registrar(eu, st.isDirectory() ? "apagou pasta" : "apagou arquivo", `${endereco(site)}/${limpo}`, detalhe, ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "mover" && req.method === "POST") {
      const { de, para } = await lerJsonCorpo(req);
      const a = alvoNoSite(id, de);
      const b = alvoNoSite(id, para);
      if (!fs.existsSync(a.alvo)) return responder(res, 404, { erro: "Não existe." });
      if (fs.existsSync(b.alvo)) return responder(res, 409, { erro: "Já existe algo com esse nome." });
      if (b.alvo.startsWith(a.alvo + path.sep)) return responder(res, 400, { erro: "Não dá para mover uma pasta para dentro dela mesma." });
      fs.mkdirSync(path.dirname(b.alvo), { recursive: true });
      fs.renameSync(a.alvo, b.alvo);
      tocar(id, eu);
      registrar(eu, "renomeou", `${endereco(site)}/${b.limpo}`, `antes: ${a.limpo}`, ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "pastas" && req.method === "GET") {
      return responder(res, 200, { pastas: todasAsPastas(id) });
    }

    // Colar: move ou copia itens de um site (este ou outro) para uma pasta
    // deste. Serve para recortar/copiar/colar, "Mover para" e arrastar.
    if (acao === "colar" && req.method === "POST") {
      const corpo = await lerJsonCorpo(req);
      const origem = String(corpo.origem || id);
      if (!sites[origem]) return responder(res, 404, { erro: "O site de origem não existe mais." });
      const op = corpo.op === "copiar" ? "copiar" : "mover";
      const conflito = ["substituir", "renomear"].includes(corpo.conflito) ? corpo.conflito : "erro";
      const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 2000) : [];
      if (!itens.length) return responder(res, 400, { erro: "Nada selecionado." });
      const destino = alvoNoSite(id, corpo.destino || "", true);
      if (!fs.existsSync(destino.alvo) || !fs.statSync(destino.alvo).isDirectory()) return responder(res, 404, { erro: "A pasta de destino não existe." });

      const plano = [];
      for (const item of itens) {
        const de = alvoNoSite(origem, item);
        if (!fs.existsSync(de.alvo)) return responder(res, 404, { erro: `"${de.limpo}" não existe mais.` });
        const para = path.join(destino.alvo, path.basename(de.alvo));
        if (para === de.alvo || para.startsWith(de.alvo + path.sep)) {
          // Colar uma cópia na própria pasta é pedir um "nome (2)"; mover
          // para o mesmo lugar não faz nada; para dentro de si mesma, não dá.
          if (para === de.alvo && op === "copiar") { plano.push({ de, para, renomear: true }); continue; }
          if (para === de.alvo) continue;
          return responder(res, 400, { erro: `Não dá para pôr a pasta "${de.limpo}" dentro dela mesma.` });
        }
        if (de.alvo.startsWith(para + path.sep)) return responder(res, 400, { erro: `"${path.basename(para)}" contém "${de.limpo}" e não pode ser substituída por ela.` });
        plano.push({ de, para, existe: fs.existsSync(para) });
      }
      const conflitos = plano.filter((p) => p.existe).map((p) => path.basename(p.para));
      if (conflitos.length && conflito === "erro") {
        return responder(res, 409, { erro: `Já existe no destino: ${conflitos.slice(0, 5).join(", ")}${conflitos.length > 5 ? "..." : ""}`, conflitos });
      }

      const livre = (p) => {
        const ext = fs.existsSync(p) && fs.statSync(p).isDirectory() ? "" : path.extname(p);
        const base = p.slice(0, p.length - ext.length);
        for (let n = 2; ; n++) if (!fs.existsSync(`${base} (${n})${ext}`)) return `${base} (${n})${ext}`;
      };
      let feitos = 0;
      for (const p of plano) {
        let para = p.para;
        if (p.renomear || (p.existe && conflito === "renomear")) para = livre(para);
        else if (p.existe) fs.rmSync(para, { recursive: true, force: true });
        if (op === "copiar") fs.cpSync(p.de.alvo, para, { recursive: true, errorOnExist: true, force: false });
        else fs.renameSync(p.de.alvo, para);
        feitos++;
      }
      tocar(id, eu);
      if (origem !== id && op === "mover") tocar(origem, eu);
      const nomes = plano.map((p) => path.basename(p.de.alvo)).join(", ");
      const deOnde = `${endereco(sites[origem])}${plano[0] ? "/" + path.dirname(plano[0].de.limpo).replace(/^\.$/, "") : ""}`.replace(/\/$/, "");
      registrar(eu, op === "copiar" ? "copiou" : "moveu", `${endereco(site)}/${destino.limpo}`.replace(/\/$/, ""),
        `${feitos} ${feitos === 1 ? "item" : "itens"} de ${deOnde}: ${nomes.length > 200 ? nomes.slice(0, 200) + "..." : nomes}`, ip);
      return responder(res, 200, { ok: true, feitos });
    }

    if (acao === "apagar" && req.method === "POST") {
      const { itens } = await lerJsonCorpo(req);
      if (!Array.isArray(itens) || !itens.length) return responder(res, 400, { erro: "Nada selecionado." });
      const alvos = itens.slice(0, 2000).map((i) => alvoNoSite(id, i));
      let arquivos = 0;
      for (const a of alvos) {
        let st;
        try {
          st = fs.lstatSync(a.alvo);
        } catch {
          continue;
        }
        arquivos += st.isDirectory() ? tamanhoPasta(a.alvo).quantos : 1;
        fs.rmSync(a.alvo, { recursive: true, force: true });
      }
      tocar(id, eu);
      const nomes = alvos.map((a) => a.limpo).join(", ");
      registrar(eu, "apagou em lote", endereco(site), `${alvos.length} itens (${arquivos} arquivos): ${nomes.length > 200 ? nomes.slice(0, 200) + "..." : nomes}`, ip);
      return responder(res, 200, { ok: true });
    }

    if (acao === "previa" && req.method === "GET") {
      const exp = Math.floor(Date.now() / 1000) + PREVIA_S;
      return responder(res, 200, { url: `previa/${exp}.${assinar(id, exp)}/${id}/` });
    }

    return responder(res, 404, { erro: "não encontrado" });
  }

  /* ---- a partir daqui, só admin ---- */

  if (req.method === "GET" && rota === "/api/historico") {
    if (!admin) return soAdmin();
    const usuario = url.searchParams.get("usuario") || "";
    const limite = Math.min(2000, Number(url.searchParams.get("limite")) || 500);
    return responder(res, 200, { linhas: lerHistorico({ usuario, limite }) });
  }

  if (rota === "/api/usuarios") {
    if (!admin) return soAdmin();
    if (req.method === "GET") {
      return responder(res, 200, { usuarios: Object.keys(usuarios).sort().map(resumoUsuario) });
    }
    if (req.method === "POST") {
      const corpo = await lerJsonCorpo(req);
      const nome = String(corpo.usuario || "").trim().toLowerCase();
      if (!NOME_USUARIO.test(nome)) return responder(res, 400, { erro: "Usuário: 2 a 32 letras minúsculas, números, ponto, hífen ou _." });
      if (usuarios[nome]) return responder(res, 409, { erro: `Já existe o usuário "${nome}".` });
      const fraca = motivoSenhaFraca(corpo.senha);
      if (fraca) return responder(res, 400, { erro: fraca });
      const papel = corpo.papel === "admin" ? "admin" : "editor";
      usuarios[nome] = { hash: hashSenha(corpo.senha), papel, criado: new Date().toISOString(), criadoPor: eu };
      salvarUsuarios();
      registrar(eu, "criou usuário", nome, papel, ip);
      return responder(res, 200, resumoUsuario(nome));
    }
    return responder(res, 405, { erro: "método não permitido" });
  }

  const mu = /^\/api\/usuarios\/([^/]+)$/.exec(rota);
  if (mu) {
    if (!admin) return soAdmin();
    const nome = decodeURIComponent(mu[1]);
    const u = usuarios[nome];
    if (!u) return responder(res, 404, { erro: "Usuário não existe." });

    if (req.method === "PATCH") {
      const corpo = await lerJsonCorpo(req);
      if (corpo.papel && corpo.papel !== u.papel) {
        const papel = corpo.papel === "admin" ? "admin" : "editor";
        if (u.papel === "admin" && papel !== "admin" && admins() <= 1) {
          return responder(res, 400, { erro: "Tem de ficar pelo menos um administrador." });
        }
        u.papel = papel;
        registrar(eu, "mudou papel", nome, papel, ip);
      }
      if (corpo.senha) {
        const fraca = motivoSenhaFraca(corpo.senha);
        if (fraca) return responder(res, 400, { erro: fraca });
        u.hash = hashSenha(corpo.senha);
        // Quem teve a senha trocada por outro sai de todas as sessões abertas.
        derrubarSessoes(nome, nome === eu ? s.token : undefined);
        registrar(eu, "definiu senha", nome, "", ip);
      }
      salvarUsuarios();
      return responder(res, 200, resumoUsuario(nome));
    }

    if (req.method === "DELETE") {
      if (nome === eu) return responder(res, 400, { erro: "Você não pode remover o próprio usuário." });
      if (u.papel === "admin" && admins() <= 1) return responder(res, 400, { erro: "Tem de ficar pelo menos um administrador." });
      delete usuarios[nome];
      salvarUsuarios();
      derrubarSessoes(nome);
      registrar(eu, "removeu usuário", nome, "", ip);
      return responder(res, 200, { ok: true });
    }
    return responder(res, 405, { erro: "método não permitido" });
  }

  if (rota === "/api/dominios") {
    if (!admin) return soAdmin();
    if (req.method === "GET") {
      const { zonas } = await dns("GET", "/zonas");
      const lista = zonas
        .filter((z) => z.nome !== PRINCIPAL)
        .map((z) => {
          const d = dominioAtivo(z.nome);
          return { ...z, sub: !!d, raiz: !!d?.raiz };
        });
      return responder(res, 200, { zonas: lista });
    }
    if (req.method === "POST") {
      const { dominio, senha, raiz } = await lerJsonCorpo(req);
      const d = String(dominio || "").toLowerCase();
      if (!DOMINIO.test(d) || d === PRINCIPAL) return responder(res, 400, { erro: "Domínio inválido." });
      // Mexe no DNS de um domínio inteiro: pede a senha de novo, para uma
      // sessão esquecida aberta não bastar.
      if (!hashConfere(usuarios[eu].hash, senha || "")) return responder(res, 400, { erro: "Senha incorreta." });
      const atual = dominioAtivo(d);
      if (raiz) {
        if (!atual) return responder(res, 400, { erro: "Ative primeiro os subdomínios desse domínio." });
        if (atual.raiz) return responder(res, 409, { erro: "A raiz desse domínio já está ativa." });
        const r = await dns("POST", "/ativar-raiz", { zona: d });
        atual.raiz = true;
        salvarDominios();
        registrar(eu, "ativou raiz do domínio", d, r.detalhe || "", ip);
      } else {
        if (atual) return responder(res, 409, { erro: "Esse domínio já está ativo." });
        const r = await dns("POST", "/ativar", { zona: d });
        dominios.push({ dominio: d, raiz: false });
        salvarDominios();
        registrar(eu, "ativou domínio", d, r.detalhe || "", ip);
      }
      return responder(res, 200, { ok: true, enderecos: opcoesEndereco() });
    }
    return responder(res, 405, { erro: "método não permitido" });
  }

  return responder(res, 404, { erro: "não encontrado" });
}

// Sessões e tentativas vencidas saem da memória de hora a hora.
setInterval(() => {
  const agora = Date.now();
  for (const [k, s] of sessoes) if (agora > s.expira) sessoes.delete(k);
  for (const [k, t] of tentativas) if (agora > t.ate) tentativas.delete(k);
}, 60 * 60 * 1000).unref();

sincronizar();
http
  .createServer((req, res) =>
    tratar(req, res).catch((e) => {
      if (!e.status) console.error(e);
      if (!res.headersSent) responder(res, e.status || 500, { erro: e.status ? e.message : "Erro no servidor." });
      else res.destroy();
    }),
  )
  .listen(PORTA, () =>
    console.log(`painel-paginas na porta ${PORTA}: ${Object.keys(sites).length} sites, ${Object.keys(usuarios).length} usuários, domínios: ${dominios.map((d) => d.dominio + (d.raiz ? " (+raiz)" : "")).join(", ") || "nenhum"}`),
  );
