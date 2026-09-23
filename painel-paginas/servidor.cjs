/**
 * Painel onde a equipa da Lumivie sobe páginas HTML soltas. Cada página vai
 * para um de dois tipos de endereço:
 *
 *   caminho      lumivie.com.br/<slug>
 *   subdomínio   <slug>.velacademy.com.br (um por domínio em DOMINIOS_SUB)
 *
 * Existe para que quem faz as páginas não precise de SSH nem de mexer no nginx
 * ou no DNS: entra com usuário e senha, cola ou envia o HTML e liga ou desliga.
 *
 * Quem serve a página ao visitante é o nginx, não este processo. Aqui só se
 * escreve `<slug>.html` na pasta publicada quando a página está ativa e se apaga
 * quando não está. Assim, se este contentor cair, as páginas continuam no ar e
 * o site principal nem percebe.
 *
 * Os subdomínios não mexem no DNS. A zona tem um registo curinga apontando para
 * o nginx, então "criar o subdomínio" é só publicar o ficheiro. Por isso este
 * processo não guarda token nenhum do Cloudflare: um token de DNS aqui dentro
 * daria a quem invadisse o painel o domínio inteiro do cliente.
 *
 * Sem dependências, pelo mesmo motivo do servidor do lead de Moçambique: é HTTP,
 * scrypt e ficheiros, e o Node já traz os três.
 *
 * Variáveis de ambiente:
 *   PAINEL_USUARIO     nome de login
 *   PAINEL_SENHA_HASH  "scrypt:<sal hex>:<hash hex>", gerado com `node senha.cjs`
 *   DOMINIO_PRINCIPAL  domínio das páginas por caminho (padrão: lumivie.com.br)
 *   DOMINIOS_SUB       domínios com curinga, separados por vírgula
 *   DADOS              pasta com o HTML de todas as páginas, ativas ou não
 *   PUBLICADO          pasta que o nginx lê para as páginas por caminho
 *   PUBLICADO_SUB      pasta com uma subpasta por domínio de DOMINIOS_SUB
 *   SITE               raiz do site principal, só leitura, para evitar slug que
 *                      colida com pasta ou ficheiro que já existe lá
 *   PORTA              padrão 8080
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORTA = Number(process.env.PORTA || 8080);
const PREFIXO = "/painel-paginas";
const DADOS = process.env.DADOS || "/dados";
const PUBLICADO = process.env.PUBLICADO || "/publicado";
const PUBLICADO_SUB = process.env.PUBLICADO_SUB || "/publicado-sub";
const SITE = process.env.SITE || "/site";
const USUARIO = process.env.PAINEL_USUARIO || "";
const SENHA_HASH = process.env.PAINEL_SENHA_HASH || "";
const PRINCIPAL = process.env.DOMINIO_PRINCIPAL || "lumivie.com.br";
const SUBS = (process.env.DOMINIOS_SUB || "").split(",").map((d) => d.trim()).filter(Boolean);

const HTML_MAX = 2 * 1024 * 1024;
const SESSAO_MS = 12 * 60 * 60 * 1000;
const PASTA_HTML = path.join(DADOS, "html");
const INDICE = path.join(DADOS, "paginas.json");

// Rotas do app React da Lumivie que não são ficheiro. O nginx serve o ficheiro
// da página antes do fallback do app, então uma página chamada "dashboard"
// esconderia o painel de leads sem dar erro nenhum.
const RESERVADOS = new Set([
  "api", "assets", "img", "fonts", "logos", "link-sp", "link-rs",
  "dashboard", "whatsapp-connect", "paginas-link", "painel-paginas",
  "index", "robots", "sitemap", "llms", "favicon",
]);

// Nomes que um domínio costuma querer para outra coisa (site, e-mail). Mesmo
// que hoje não existam na zona, ocupá-los com uma página daria trabalho depois.
const RESERVADOS_SUB = new Set([
  "www", "mail", "webmail", "smtp", "imap", "pop", "ftp", "cpanel", "ns1", "ns2",
  "autodiscover", "autoconfig", "api", "app", "admin",
]);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

fs.mkdirSync(PASTA_HTML, { recursive: true });
fs.mkdirSync(PUBLICADO, { recursive: true });
for (const d of SUBS) fs.mkdirSync(path.join(PUBLICADO_SUB, d), { recursive: true });

/* ------------------------------------------------------------ armazenamento */

// A chave de cada página é "<domínio>/<slug>": o mesmo slug pode existir em
// lumivie.com.br e em velacademy.com.br sem se confundirem.
const chaveDe = (dominio, slug) => `${dominio}/${slug}`;
const partes = (chave) => {
  const i = chave.indexOf("/");
  return { dominio: chave.slice(0, i), slug: chave.slice(i + 1) };
};
const ehSub = (dominio) => SUBS.includes(dominio);
const endereco = (dominio, slug) => (ehSub(dominio) ? `${slug}.${dominio}` : `${dominio}/${slug}`);

function lerIndice() {
  try {
    const bruto = JSON.parse(fs.readFileSync(INDICE, "utf8"));
    // Antes dos subdomínios a chave era só o slug. Converte na leitura.
    const out = {};
    for (const [k, v] of Object.entries(bruto)) {
      const chave = k.includes("/") ? k : chaveDe(PRINCIPAL, k);
      out[chave] = v;
      if (!k.includes("/") && fs.existsSync(path.join(PASTA_HTML, `${k}.html`))) {
        fs.renameSync(path.join(PASTA_HTML, `${k}.html`), arquivoHtml(chave));
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Escrever num temporário e renomear: um rename é atómico, então o nginx nunca
// serve meia página e um corte de energia não deixa o índice truncado.
function escreverAtomico(destino, conteudo) {
  const tmp = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, conteudo);
  fs.renameSync(tmp, destino);
}

function arquivoHtml(chave) {
  const { dominio, slug } = partes(chave);
  return path.join(PASTA_HTML, `${dominio}__${slug}.html`);
}
function arquivoPublicado(chave) {
  const { dominio, slug } = partes(chave);
  return ehSub(dominio) ? path.join(PUBLICADO_SUB, dominio, `${slug}.html`) : path.join(PUBLICADO, `${slug}.html`);
}

let indice = lerIndice();
const salvarIndice = () => escreverAtomico(INDICE, JSON.stringify(indice, null, 2));

function publicar(chave) {
  if (indice[chave]?.ativo) {
    escreverAtomico(arquivoPublicado(chave), fs.readFileSync(arquivoHtml(chave)));
  } else {
    fs.rmSync(arquivoPublicado(chave), { force: true });
  }
}

// Ao subir, as pastas publicadas passam a refletir o índice. Cobre um deploy
// que tenha apagado a pasta ou uma página desligada à mão.
function sincronizar() {
  for (const chave of Object.keys(indice)) publicar(chave);
  const limpar = (pasta, dominio) => {
    for (const nome of fs.readdirSync(pasta)) {
      if (!nome.endsWith(".html")) continue;
      if (!indice[chaveDe(dominio, nome.slice(0, -5))]?.ativo) fs.rmSync(path.join(pasta, nome), { force: true });
    }
  };
  limpar(PUBLICADO, PRINCIPAL);
  for (const d of SUBS) limpar(path.join(PUBLICADO_SUB, d), d);
}

// O curinga só vale para nomes que a zona não tem. Se o nome já tiver registo
// próprio (outro servidor), a página nunca apareceria, então pergunta-se ao
// próprio endereço: só o nosso nginx responde com a marca.
async function subLivre(dominio, slug) {
  try {
    const r = await fetch(`https://${slug}.${dominio}/.painel-paginas`, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    return (await r.text()).trim() === "painel-paginas";
  } catch {
    return false;
  }
}

async function motivoInvalido(dominio, slug) {
  if (!SLUG.test(slug)) return "Use só letras minúsculas, números e hífen (ex.: promo-setembro).";
  if (ehSub(dominio)) {
    if (RESERVADOS_SUB.has(slug)) return `"${slug}.${dominio}" fica reservado para o próprio domínio.`;
    if (!(await subLivre(dominio, slug))) return `"${slug}.${dominio}" já está em uso por outro serviço.`;
    return null;
  }
  if (RESERVADOS.has(slug)) return `"${slug}" já é usado pelo site da Lumivie.`;
  try {
    const existentes = fs.readdirSync(SITE).map((n) => n.replace(/\.[^.]+$/, "").toLowerCase());
    if (existentes.includes(slug)) return `"${slug}" já é uma pasta ou ficheiro do site.`;
  } catch {}
  return null;
}

/* ------------------------------------------------------------------- sessão */

const sessoes = new Map();
const tentativas = new Map();

function senhaConfere(usuario, senha) {
  const [alg, salHex, hashHex] = SENHA_HASH.split(":");
  if (alg !== "scrypt" || !salHex || !hashHex || !USUARIO) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtido = crypto.scryptSync(String(senha), Buffer.from(salHex, "hex"), esperado.length);
  // O usuário também passa por comparação de tempo constante, para a resposta
  // não dizer se o erro foi no nome ou na senha.
  const u1 = crypto.createHash("sha256").update(String(usuario)).digest();
  const u2 = crypto.createHash("sha256").update(USUARIO).digest();
  return crypto.timingSafeEqual(u1, u2) & crypto.timingSafeEqual(obtido, esperado);
}

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

function sessaoDe(req) {
  const m = /(?:^|;\s*)painel=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  if (!m) return null;
  const s = sessoes.get(m[1]);
  if (!s || Date.now() > s.expira) {
    sessoes.delete(m[1]);
    return null;
  }
  return m[1];
}

const cookie = (valor, idade) =>
  `painel=${valor}; Path=${PREFIXO}; HttpOnly; Secure; SameSite=Strict; Max-Age=${idade}`;

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

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    const pedacos = [];
    let total = 0;
    req.on("data", (p) => {
      total += p.length;
      if (total > HTML_MAX + 64 * 1024) {
        falha(Object.assign(new Error("grande"), { status: 413 }));
        req.destroy();
      } else pedacos.push(p);
    });
    req.on("end", () => {
      try {
        ok(JSON.parse(Buffer.concat(pedacos).toString("utf8") || "{}"));
      } catch {
        falha(Object.assign(new Error("json"), { status: 400 }));
      }
    });
    req.on("error", falha);
  });
}

function resumo(chave) {
  const p = indice[chave];
  const { dominio, slug } = partes(chave);
  return {
    id: chave, dominio, slug, endereco: endereco(dominio, slug),
    ativo: !!p.ativo, criado: p.criado, atualizado: p.atualizado, bytes: p.bytes,
  };
}

const dominios = () => [
  { dominio: PRINCIPAL, tipo: "caminho" },
  ...SUBS.map((d) => ({ dominio: d, tipo: "sub" })),
];

async function tratar(req, res) {
  const url = new URL(req.url, "http://x");
  const rota = url.pathname.startsWith(PREFIXO) ? url.pathname.slice(PREFIXO.length) : null;
  if (rota === null) return responder(res, 404, { erro: "não encontrado" });

  // HEAD também: monitor de uptime e pré-visualização de link usam HEAD, e o
  // Node já descarta o corpo sozinho.
  const leitura = req.method === "GET" || req.method === "HEAD";
  if (leitura && (rota === "/" || rota === "")) return responder(res, 200, PAINEL);
  if (req.method === "GET" && rota === "/saude") {
    return responder(res, 200, { ok: true, configurado: !!(USUARIO && SENHA_HASH), paginas: Object.keys(indice).length, dominios: dominios() });
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
    const { usuario, senha } = await lerCorpo(req);
    if (!senhaConfere(usuario || "", senha || "")) {
      registrarErro(ip);
      console.log(`login recusado ip=${ip}`);
      return responder(res, 401, { erro: "Usuário ou senha incorretos." });
    }
    tentativas.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessoes.set(token, { expira: Date.now() + SESSAO_MS });
    console.log(`login ok ip=${ip}`);
    return responder(res, 200, { ok: true }, { "Set-Cookie": cookie(token, SESSAO_MS / 1000) });
  }

  const token = sessaoDe(req);
  if (rota === "/api/sair" && req.method === "POST") {
    if (token) sessoes.delete(token);
    return responder(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  }
  if (!token) return responder(res, 401, { erro: "Sessão expirada. Entre de novo." });

  if (req.method === "GET" && rota === "/api/paginas") {
    const lista = Object.keys(indice).map(resumo).sort((a, b) => a.endereco.localeCompare(b.endereco));
    return responder(res, 200, { paginas: lista, dominios: dominios() });
  }

  const m = /^\/api\/paginas\/([^/]+)$/.exec(rota);
  if (!m) return responder(res, 404, { erro: "não encontrado" });
  const chave = decodeURIComponent(m[1]);

  if (req.method === "GET") {
    if (!indice[chave]) return responder(res, 404, { erro: "Página não existe." });
    return responder(res, 200, { ...resumo(chave), html: fs.readFileSync(arquivoHtml(chave), "utf8") });
  }

  if (req.method === "PUT") {
    const corpo = await lerCorpo(req);
    const existe = !!indice[chave];
    if (corpo.criar && existe) return responder(res, 409, { erro: `Já existe essa página.` });
    if (!corpo.criar && !existe) return responder(res, 404, { erro: "Página não existe." });

    const atual = existe ? partes(chave) : {};
    const dominio = String(corpo.dominio || atual.dominio || PRINCIPAL);
    const slug = String(corpo.slug || atual.slug || "");
    if (dominio !== PRINCIPAL && !ehSub(dominio)) return responder(res, 400, { erro: "Domínio não configurado." });
    const nova = chaveDe(dominio, slug);
    const ativo = corpo.ativo === undefined ? !!indice[chave]?.ativo : !!corpo.ativo;

    if (nova !== chave || !existe) {
      if (indice[nova]) return responder(res, 409, { erro: `Já existe uma página em ${endereco(dominio, slug)}.` });
      const motivo = await motivoInvalido(dominio, slug);
      if (motivo) return responder(res, 400, { erro: motivo });
    }
    const html = typeof corpo.html === "string" ? corpo.html : "";
    if (!html.trim()) return responder(res, 400, { erro: "O HTML está vazio." });
    if (Buffer.byteLength(html) > HTML_MAX) return responder(res, 413, { erro: "HTML maior que 2 MB." });

    const agora = new Date().toISOString();
    const antes = indice[chave];
    escreverAtomico(arquivoHtml(nova), html);
    indice[nova] = { ativo, criado: antes?.criado || agora, atualizado: agora, bytes: Buffer.byteLength(html) };
    if (nova !== chave && existe) {
      fs.rmSync(arquivoPublicado(chave), { force: true });
      fs.rmSync(arquivoHtml(chave), { force: true });
      delete indice[chave];
    }
    salvarIndice();
    publicar(nova);
    console.log(`salvo ${chave}${nova !== chave ? ` -> ${nova}` : ""} ativo=${ativo} ip=${ip}`);
    return responder(res, 200, resumo(nova));
  }

  if (req.method === "PATCH") {
    if (!indice[chave]) return responder(res, 404, { erro: "Página não existe." });
    const { ativo } = await lerCorpo(req);
    indice[chave].ativo = !!ativo;
    salvarIndice();
    publicar(chave);
    console.log(`${ativo ? "ligada" : "desligada"} ${chave} ip=${ip}`);
    return responder(res, 200, resumo(chave));
  }

  if (req.method === "DELETE") {
    if (!indice[chave]) return responder(res, 404, { erro: "Página não existe." });
    fs.rmSync(arquivoPublicado(chave), { force: true });
    fs.rmSync(arquivoHtml(chave), { force: true });
    delete indice[chave];
    salvarIndice();
    console.log(`apagada ${chave} ip=${ip}`);
    return responder(res, 200, { ok: true });
  }

  return responder(res, 405, { erro: "método não permitido" });
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
      if (!res.headersSent) responder(res, e.status || 500, { erro: e.status === 413 ? "HTML maior que 2 MB." : "Erro no servidor." });
    }),
  )
  .listen(PORTA, () => console.log(`painel-paginas na porta ${PORTA}, ${Object.keys(indice).length} páginas, subdomínios: ${SUBS.join(", ") || "nenhum"}`));
