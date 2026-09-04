/**
 * O lead da LP de Moçambique vira linha na planilha.
 *
 * Mesma forma da página da Sofer (`api/leads.ts` na Vercel): o navegador posta
 * num endereço do servidor e é o servidor que fala com o Google. A credencial
 * nunca chega ao navegador, que é a razão de existir esta peça: uma página
 * estática não pode guardar segredo nenhum.
 *
 * A diferença para a Sofer é onde isto corre. Lá havia Vercel, com funções
 * prontas. Aqui a página é ficheiro estático atrás do nginx, então o mesmo
 * papel é feito por este processo, num contentor sem porta publicada, alcançado
 * só pelo nginx pela rede interna do Docker.
 *
 * Sem biblioteca do Google, de propósito: é um JWT assinado e duas chamadas
 * HTTP, e a dependência traria centenas de ficheiros para a imagem. É a mesma
 * escolha que o servidor da Lumivie já fazia em `src/sheets.js`, nesta VPS.
 *
 * Variáveis de ambiente:
 *   GOOGLE_SA_BASE64  JSON da conta de serviço, em base64 (cabe numa env var)
 *   PLANILHA_LEADS    id da planilha
 *   PLANILHA_ABA      nome da aba (padrão: Página1)
 *   PORTA             padrão 8080
 */
const http = require("http");
const crypto = require("crypto");
const { linhaDe } = require("./colunas.cjs");

const PORTA = Number(process.env.PORTA || 8080);
const PLANILHA = process.env.PLANILHA_LEADS || "";
const ABA = process.env.PLANILHA_ABA || "Página1";
const CORPO_MAX = 16 * 1024;

/** As credenciais chegam em base64 para o JSON caber numa variável de ambiente
 *  sem se preocupar com as quebras de linha da chave privada. */
const sa = (() => {
  try {
    const j = JSON.parse(Buffer.from(process.env.GOOGLE_SA_BASE64 || "", "base64").toString("utf8"));
    return j.client_email && j.private_key ? j : null;
  } catch {
    return null;
  }
})();

const b64 = (o) =>
  Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

// O token vale uma hora. Guardar evita um par de chamadas extra ao Google em
// cada lead, e num pico de campanha isso é a diferença entre responder rápido e
// esperar a rede duas vezes.
let token = null;
let expira = 0;

async function acesso() {
  if (token && Date.now() < expira) return token;
  if (!sa) throw new Error("conta de serviço não configurada");
  const agora = Math.floor(Date.now() / 1000);
  const base = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  })}`;
  const assinatura = crypto.createSign("RSA-SHA256").update(base).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${base}.${assinatura}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Google recusou a autenticação: ${j.error_description || j.error || r.status}`);
  token = j.access_token;
  expira = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
  return token;
}

async function gravar(valores) {
  const t = await acesso();
  // RAW e não USER_ENTERED: com USER_ENTERED uma mensagem começada por "=" ou
  // "+" vira fórmula, e um telemóvel perde o "+" e os zeros à esquerda.
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${PLANILHA}/values/` +
    `${encodeURIComponent(ABA)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [valores] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Sheets respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).updates?.updatedRange;
}

/**
 * Um teto por IP, em memória.
 *
 * Não é anti-abuso a sério, é para um script que descubra o endereço não
 * conseguir encher a planilha da equipa em segundos. Em memória chega: o
 * processo é um só, e se ele reiniciar o contador zerar não custa nada.
 */
const vistos = new Map();
const JANELA = 60_000;
const TETO = 8;

function demais(ip) {
  const agora = Date.now();
  const t = (vistos.get(ip) || []).filter((x) => agora - x < JANELA);
  t.push(agora);
  vistos.set(ip, t);
  if (vistos.size > 5000) vistos.clear(); // não crescer sem fim
  return t.length > TETO;
}

const responder = (res, codigo, corpo) => {
  const txt = JSON.stringify(corpo);
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(txt) });
  res.end(txt);
};

const servidor = http.createServer((req, res) => {
  // O nginx é quem fala com a internet; o IP real vem no cabeçalho dele.
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

  if (req.url === "/saude") return responder(res, 200, { ok: true, planilha: Boolean(PLANILHA && sa) });
  if (req.method !== "POST") return responder(res, 405, { erro: "só POST" });
  if (demais(ip)) return responder(res, 429, { erro: "demasiados envios" });

  let bruto = "";
  let grande = false;
  req.on("data", (p) => {
    if (grande) return;
    bruto += p;
    if (bruto.length > CORPO_MAX) {
      grande = true;
      responder(res, 413, { erro: "corpo grande demais" });
      req.destroy();
    }
  });
  req.on("end", async () => {
    if (grande) return;
    let corpo;
    try {
      corpo = JSON.parse(bruto || "null");
    } catch {
      return responder(res, 400, { erro: "json inválido" });
    }
    const d = Array.isArray(corpo) ? corpo[0] : corpo;
    if (!d || !d.nome || !d.email || !d.telefone) {
      return responder(res, 400, { erro: "nome, email e telefone são obrigatórios" });
    }

    /* Responde ANTES de falar com o Google, e nunca devolve erro ao formulário.
       Quando isto corre, a paciente já carregou no botão e está a caminho do
       WhatsApp: um Google lento ou fora do ar não pode virar erro na cara dela
       nem segurar a navegação. A falha fica no log do contentor, que é onde
       alguém a pode ver. É a mesma escolha do `api/leads.ts` da Sofer. */
    responder(res, 200, { estado: "ok" });
    try {
      const onde = await gravar(linhaDe(d));
      console.log(`[lead] ${d.nome} <${d.email}> gravado em ${onde}`);
    } catch (e) {
      console.error(`[lead] FALHOU para ${d.nome} <${d.email}>: ${e.message}`);
      console.error(`[lead] payload perdido: ${JSON.stringify(d).slice(0, 2000)}`);
    }
  });
});

servidor.listen(PORTA, () => {
  console.log(`lead de Moçambique à escuta na porta ${PORTA}`);
  console.log(`conta de serviço: ${sa ? sa.client_email : "NÃO CONFIGURADA"}`);
  console.log(`planilha: ${PLANILHA || "NÃO CONFIGURADA"} / aba ${ABA}`);
});
