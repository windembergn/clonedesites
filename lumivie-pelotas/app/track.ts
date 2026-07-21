/**
 * Medição da página de link na bio.
 *
 * Manda para a mesma API do site da Lumivie, para tudo aparecer num dashboard
 * só. Sem cookies e sem dado pessoal: um id anônimo por visita guardado em
 * sessionStorage (morre com a aba), qual página é, e em que botão a pessoa
 * clicou. A localização é derivada no servidor a partir dos cabeçalhos da
 * Cloudflare — o IP nunca é gravado.
 */

const ENDPOINT = "https://lumivie.com.br/api/track";
const KEY = "lumivie.visit";

/**
 * crypto.randomUUID() só existe em contexto seguro e lança fora dele; nada
 * aqui pode derrubar a página, então há caminho alternativo e tudo é envolto
 * em try/catch.
 */
function uuid(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
  }
}

function visitId(): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
    const fresh = uuid();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return uuid();
  }
}

function device(): string {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function send(payload: object, beacon = false) {
  const json = JSON.stringify(payload);
  try {
    if (beacon && navigator.sendBeacon) {
      // text/plain e um tipo seguro para CORS: nao dispara preflight. Com
      // application/json o navegador pediria OPTIONS antes, e o sendBeacon
      // manda em modo credentials:include, o que exigiria ainda mais do
      // servidor para um dado que nem precisa de credencial.
      navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: json,
      keepalive: true,
      mode: "cors",
    }).catch(() => {});
  } catch {
    /* medição nunca pode aparecer para o visitante */
  }
}

/** `site` identifica a página: link-sp, link-rs ou link-christian. */
export function initTracking(site: string) {
  try {
    const id = visitId();
    const params = new URLSearchParams(window.location.search);

    send({
      visitId: id,
      site,
      pageview: {
        path: window.location.pathname,
        referrer: document.referrer || null,
        device: device(),
        utmSource: params.get("utm_source"),
        utmMedium: params.get("utm_medium"),
        utmCampaign: params.get("utm_campaign"),
      },
    });

    // Captura: os cards são links que tiram a pessoa da página, então o clique
    // precisa sair antes da navegação — daí o sendBeacon.
    document.addEventListener(
      "click",
      (e) => {
        try {
          const el = (e.target as Element | null)?.closest<HTMLElement>("a, button");
          if (!el) return;
          const label =
            el.dataset.cta ||
            el.getAttribute("aria-label") ||
            (el.innerText || "").replace(/\s+/g, " ").trim() ||
            el.getAttribute("href") ||
            el.tagName.toLowerCase();

          send(
            {
              visitId: id,
              site,
              events: [
                {
                  t: "click",
                  key: `${site}:${label}`.toLowerCase().slice(0, 120),
                  label: label.slice(0, 80),
                  section: null,
                  href: el.getAttribute("href"),
                  site,
                },
              ],
            },
            true,
          );
        } catch {
          /* nunca quebrar um clique por causa da medição */
        }
      },
      { capture: true, passive: true },
    );
  } catch {
    /* idem */
  }
}
