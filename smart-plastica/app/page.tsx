import WarpBackground from "./WarpBackground";

const CDN = "https://framerusercontent.com/images";

// Cards (imagem = link). A ordem e os links replicam o site original.
const cards = [
  {
    img: `${CDN}/fkIraCECyXhUEzC1PHh7OkFitY.png`,
    href: "https://wa.me/5511952136738",
    label: "Agende sua consulta em São Paulo",
  },
  {
    img: `${CDN}/g5Qlg0udJ2clERTePkvhibqAWE.png`,
    href: "http://lumivi.com.br/",
    label: "Acesse o site da Lumivi",
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
            src="/logo-lumivi.jpeg"
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
