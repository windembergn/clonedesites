/**
 * O que difere entre as duas unidades da Lumivie.
 *
 * A arte dos cards não cita cidade, então o código é o mesmo: só mudam o link
 * de WhatsApp (cada unidade tem o seu rastreio no tintim.link) e o Meta Pixel.
 * Antes isso vivia como duas cópias do projeto — uma delas só existindo no
 * servidor —, o que garantia que uma correção fosse aplicada em uma e
 * esquecida na outra.
 *
 * Escolha a unidade no build com NEXT_PUBLIC_UNIDADE=sp | pelotas.
 */

export type UnidadeKey = "sp" | "pelotas";

type Unidade = {
  key: UnidadeKey;
  nome: string;
  whatsapp: string;
  metaPixelId: string;
};

const UNIDADES: Record<UnidadeKey, Unidade> = {
  sp: {
    key: "sp",
    nome: "São Paulo - SP",
    whatsapp:
      "https://tintim.link/whatsapp/5880db1a-90a2-495e-9a51-27dc9c28bc7e/07283f4c-4119-4f10-81d9-ea7643071578",
    metaPixelId: "26939711942372756",
  },
  pelotas: {
    key: "pelotas",
    nome: "Pelotas - RS",
    whatsapp:
      "https://tintim.link/whatsapp/e0860eef-331a-481e-8575-13e5561495d5/be4636d3-9229-4aa2-b5ef-aad78844bfb0",
    metaPixelId: "1560704075587529",
  },
};

// `process.env.NEXT_PUBLIC_*` é substituído em tempo de build, então precisa
// aparecer escrito por extenso — desestruturar quebraria a substituição.
const escolhida = (process.env.NEXT_PUBLIC_UNIDADE || "pelotas") as UnidadeKey;

export const unidade: Unidade = UNIDADES[escolhida] ?? UNIDADES.pelotas;

/** Site institucional — o mesmo para as duas unidades. */
export const SITE_URL = "https://lumivie.com.br";

/**
 * Prefixo dos arquivos de `public/`.
 *
 * O `basePath` do Next reescreve links internos e `next/image`, mas NÃO o
 * `src` de uma `<img>` comum — que é o que esta página usa. Sem este prefixo,
 * `/cards/card-site.jpg` apontaria para a raiz do domínio e daria 404 quando
 * servido em /link-sp.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const asset = (path: string) => `${BASE}${path}`;
