"use client";

/* ---------------------------------------------------------------------------
   Tique da roleta de especialidades. Portado do site da Lumivie.

   Por que não um <audio>: cada play() ali custa um seek mais um decode na
   thread de mídia (dezenas de ms), e um elemento só corta a própria cauda
   quando os tiques vêm rápido. Web Audio toca um buffer já decodificado, então
   o som sai no mesmo quadro da rotação e os tiques podem sobrepor-se.

   O custo de carga fica fora do caminho crítico: os bytes só são buscados
   quando o browser está ocioso, e o decode acontece no primeiro gesto do
   utilizador, que é o momento em que o som poderia legalmente tocar.
--------------------------------------------------------------------------- */

let bytes: ArrayBuffer | null = null;
let buscando: Promise<void> | null = null;
let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let ganho: GainNode | null = null;
let armado = false;

/** Só depois do load E de a thread principal ficar ociosa: sozinho, o
 *  requestIdleCallback dispara nas folgas do próprio carregamento e estes bytes
 *  competiriam com as imagens da primeira tela. A roleta está longe. */
function quandoOcioso(fn: () => void) {
  const agenda = () =>
    typeof requestIdleCallback === "function"
      ? requestIdleCallback(fn, { timeout: 3000 })
      : window.setTimeout(fn, 500);
  if (document.readyState === "complete") agenda();
  else window.addEventListener("load", agenda, { once: true });
}

function buscar(url: string) {
  if (bytes || buscando) return buscando;
  buscando = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => {
      bytes = b;
    })
    .catch(() => {
      /* som é enfeite: nunca deixar a falha subir */
    });
  return buscando;
}

/* O browser só liberta áudio depois de um gesto real, e roda de rato NÃO conta.
   Daí ouvir todos os gestos que contam: o primeiro clique, toque ou tecla em
   qualquer ponto da página arma o som. */
const GESTOS = ["pointerdown", "touchstart", "touchend", "keydown", "click"] as const;

/** Tem de correr todo de forma síncrona: o iOS só honra resume() enquanto o
 *  gesto ainda está na pilha. */
function destrancar(volume: number) {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    ganho = ctx.createGain();
    ganho.gain.value = volume;
    ganho.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  try {
    // Buffer vazio de uma amostra: o iOS só considera o contexto destrancado
    // depois de algo ter passado mesmo por ele.
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ganho!);
    s.start(0);
  } catch {
    /* ignora */
  }
}

let decodificando: Promise<void> | null = null;

function decodificar(url: string) {
  if (buffer || decodificando || !ctx) return decodificando;
  decodificando = (async () => {
    await buscar(url);
    if (!bytes || !ctx) return;
    try {
      // decodeAudioData desanexa o buffer, então vai uma cópia.
      buffer = await ctx.decodeAudioData(bytes.slice(0));
    } catch {
      /* ignora */
    }
  })();
  return decodificando;
}

/** Seguro de chamar na montagem: nada é criado nem tocado antes de o browser
 *  ficar ocioso, e nenhum som sai antes de um gesto real. */
export function prepararTique(url: string, volume = 0.35) {
  if (armado) return;
  armado = true;

  quandoOcioso(() => buscar(url));

  const noGesto = () => {
    destrancar(volume);
    void decodificar(url);
    if (ctx?.state === "running" && buffer) {
      for (const g of GESTOS) window.removeEventListener(g, noGesto, true);
    }
  };

  // Fase de captura: o Observer da roleta usa preventDefault, e qualquer coisa
  // que pare a propagação a subir engoliria o gesto antes de a janela o ver.
  for (const g of GESTOS) {
    window.addEventListener(g, noGesto, { passive: true, capture: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx?.state === "suspended") {
      void ctx.resume();
    }
  });
}

/** Toca um tique. Não faz nada até o som estar armado, e nunca atira. */
export function tocarTique() {
  if (!ctx || !buffer || !ganho) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
    return;
  }
  if (ctx.state !== "running") return;
  try {
    // Uma fonte nova por tique: são de uso único, e assim rotações rápidas
    // sobrepõem-se em vez de se cortarem.
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(ganho);
    fonte.start();
  } catch {
    /* ignora */
  }
}
