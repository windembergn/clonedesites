"use client";

/* ---------------------------------------------------------------------------
   Envio do lead. Vai para dois sítios, e os dois em paralelo.

   1. **A nossa planilha**, por `/api/lead`, que é um processo na VPS. É a mesma
      forma da página da Sofer (`api/leads.ts` na Vercel): o navegador posta num
      endereço do servidor e é o servidor que fala com o Google. A credencial
      nunca chega ao navegador, e é por isso que esta peça existe: uma página
      estática não pode guardar segredo nenhum.
   2. **O webhook do Make**, que é de outra pessoa e só recebe. Não escreve na
      planilha, e continua aqui porque quem tem acesso a ele conta com o envio.

   Os dois em paralelo, e não em fila, porque a paciente está a caminho do
   WhatsApp: somar os dois tempos atrasaria a navegação sem ganhar nada.

   Duas coisas foram copiadas de lá de propósito, porque o cenário do Make já
   está montado em cima delas:

   1. **O corpo vai como array de um item.** O Make infere a estrutura do
      webhook a partir da primeira amostra recebida; mandar um objeto solto
      depois quebraria o mapeamento do outro lado.
   2. **Cada campo aparece em snake_case e em camelCase.** Assim o cenário
      encontra o nome que já usa, sem precisar de ajuste.

   Nada aqui pode bloquear ou atirar: quando isto corre, a paciente já carregou
   no botão e está a caminho do WhatsApp. Um serviço de terceiro fora do ar não
   pode virar erro no formulário.
--------------------------------------------------------------------------- */

const WEBHOOK = "https://hook.us2.make.com/ys6hz4dj7kppybsnod8i9mim621b21cg";

/* Caminho relativo com o basePath à frente. A página é servida sob
   `/mocambique`, e sem isto o pedido bateria na raiz do domínio, que é outra
   página. O `NEXT_PUBLIC_BASE_PATH` é fixado no build pelo `next.config.mjs`. */
const ENDERECO_PLANILHA = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/lead`;

const TIMEOUT_MS = 4000;

const texto = (v: unknown) => {
  const s = (v ?? "").toString().trim();
  return s || null;
};

/** Rótulo grosso da origem, no mesmo espírito do `channel` da Lumivie. Serve
 *  para separar pago de orgânico num relatório, não para atribuição de
 *  verdade: essa mora no gerenciador de anúncios. */
function canal(
  origem: string | null,
  meio: string | null,
  referrer: string | null
) {
  const s = (origem || "").toLowerCase();
  const m = (meio || "").toLowerCase();
  const pago = m.includes("cpc") || m.includes("paid") || m.includes("ppc");
  if (s.includes("google")) return pago ? "google_ads" : "google";
  if (s.includes("face") || s.includes("insta") || s === "ig" || s === "fb")
    return pago ? "meta_ads" : "meta";
  if (s) return pago ? `${s}_ads` : s;
  if (referrer) {
    let host = "";
    try {
      host = new URL(referrer).host;
    } catch {
      /* referrer inválido: trata como direto */
    }
    if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return "organic_search";
    return host ? "referral" : "direct";
  }
  return "direct";
}

/* O que a paciente escreve no telemóvel vai como está, porque é o que a equipa
   vê e liga. Ao lado segue uma versão só de algarismos, que é o formato que o
   WhatsApp aceita num link `wa.me`. Quando o número tem nove algarismos e começa
   por 8, é telemóvel moçambicano escrito sem indicativo, então leva o 258 à
   frente; fora desse caso ninguém adivinha o país e o número segue como veio. */
function paraWhatsapp(bruto: string) {
  const d = bruto.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9 && d.startsWith("8")) return `258${d}`;
  return d;
}

export interface DadosLead {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  procedimento: string;
  mensagem: string;
}

export function montarPayload(d: DadosLead) {
  const q = new URLSearchParams(window.location.search);
  const pega = (k: string) => texto(q.get(k));

  const utm = {
    source: pega("utm_source"),
    medium: pega("utm_medium"),
    campaign: pega("utm_campaign"),
    term: pega("utm_term"),
    content: pega("utm_content"),
  };
  const referrer = texto(document.referrer);
  const ua = texto(navigator.userAgent);

  return {
    nome: texto(d.nome),
    name: texto(d.nome),

    // E-mail e telemóvel são obrigatórios no formulário: a conversa segue para o
    // WhatsApp, mas o lead tem de continuar contactável se ela não responder lá.
    email: texto(d.email),
    telefone: texto(d.telefone),
    phone: texto(d.telefone),
    whatsapp: paraWhatsapp(d.telefone),

    cidade: texto(d.cidade),
    city: texto(d.cidade),
    pais: "Moçambique",
    country: "Moçambique",

    unidade: "São Paulo",
    unidadeSlug: "sao-paulo",
    unitSlug: "sao-paulo",

    procedimento: texto(d.procedimento),
    procedure: texto(d.procedimento),
    mensagem: texto(d.mensagem),
    message: texto(d.mensagem),

    origem: "lp-mocambique",
    channel: canal(utm.source, utm.medium, referrer),
    utmSource: utm.source,
    utm_source: utm.source,
    utmMedium: utm.medium,
    utm_medium: utm.medium,
    utmCampaign: utm.campaign,
    utm_campaign: utm.campaign,
    utmTerm: utm.term,
    utm_term: utm.term,
    utmContent: utm.content,
    utm_content: utm.content,

    pageOrigin: window.location.pathname,
    paginaOrigem: window.location.pathname,
    pageTitle: document.title,
    urlCompleta: window.location.href,
    referrer,

    user_agent: ua,
    userAgent: ua,

    enviadoEm: new Date().toISOString(),
  };
}

/** Devolve sempre. Nunca atira, nunca segura a navegação. */
export async function enviarLead(d: DadosLead) {
  // Um payload só, mandado aos dois. O corpo vai como array de um item também
  // para a nossa planilha, para não haver dois formatos a manter.
  const corpo = JSON.stringify([montarPayload(d)]);

  const manda = (url: string) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `keepalive` deixa o pedido terminar depois de a página navegar para o
      // WhatsApp; o timeout garante que ninguém fica à espera de um serviço
      // lento.
      keepalive: true,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: corpo,
    });

  // `allSettled` e não `all`: um dos dois fora do ar não pode levar o outro
  // atrás, e nenhum dos dois pode virar erro na cara da paciente.
  await Promise.allSettled([manda(ENDERECO_PLANILHA), manda(WEBHOOK)]);
}
