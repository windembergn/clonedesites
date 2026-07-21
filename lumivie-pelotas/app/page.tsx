import WarpBackground from "./WarpBackground";
import Tracker from "./Tracker";
import { asset, SITE_URL, unidade } from "./unidade";

// Cards (imagem = link). Artes locais em public/cards/ — as mesmas nas duas
// unidades (a arte não cita cidade); só o link do WhatsApp muda.
const cards = [
  {
    img: asset("/cards/card-whatsapp.jpg"),
    href: unidade.whatsapp,
    label: "Agende sua consulta",
  },
  {
    img: asset("/cards/card-site.jpg"),
    href: SITE_URL,
    label: "Acesse o site da Lumivie",
  },
];

function VerifiedBadge() {
  return (
    <svg className="badge" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#3a86e0"
        d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.19L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.69L23 12z"
      />
      <path
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        d="M8 12.2l2.7 2.7 5.3-5.5"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* Fundo animado (shader Warp) — paleta COBRE/DOURADO idêntica ao original */}
      <Tracker site={unidade.trackSite} />

      <WarpBackground
        color1="#E0DACF"
        color2="#914B2F"
        color3="#5B2C1E"
        speed={0.3}
      />

      <main className="page">
        <div className="column">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="avatar"
            src={asset("/logo-lumivi.jpeg")}
            alt="Lumivie"
          />

          <h1 className="name">
            Lumivie Clinique
            <VerifiedBadge />
          </h1>

          <p className="tagline">O extraordinário começa em você</p>

          <div className="cards">
            {cards.map((c) => (
              <a
                key={c.href}
                className="card"
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={c.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt={c.label} />
              </a>
            ))}
          </div>

          <p className="footer">© Lumivie</p>
        </div>
      </main>
    </>
  );
}
