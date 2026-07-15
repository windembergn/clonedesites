import WarpBackground from "./WarpBackground";

const CDN = "https://framerusercontent.com/images";

// Cards (imagem = link). A ordem e os links replicam o site original.
const cards = [
  {
    img: `${CDN}/kfpuAQBpEcwpGoQH7AgrMsRE.png`,
    href:
      "https://wa.me/5511952136738?text=Ol%C3%A1%21%20Vim%20da%20bio%20do%20Instagram%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20a%20consulta%20em%20S%C3%A3o%20Paulo",
    label: "Agendar consulta",
  },
  {
    img: `${CDN}/HbzzQSy95mXVVY4Zv1xbnMxyNo.png`,
    href: "https://drchristianferreira.com.br/",
    label: "Conheça o Dr. Christian Ferreira",
  },
  {
    img: `${CDN}/HBpZbSO2CcAIyxip0zDHuYlJMI.png`,
    href: "https://www.tiktok.com/@drchristianferreira",
    label: "TikTok do Dr. Christian Ferreira",
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
      {/* Fundo animado (shader Warp) — paleta BRONZE FOSCO + TRAVERTINO */}
      <WarpBackground
        color1="#E4D5BE"
        color2="#8B6F49"
        color3="#46351F"
        speed={0.3}
      />

      <main className="page">
        <div className="column">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="avatar"
            src={`${CDN}/yuFi9KyyL6vnrzX8iInCfFswVQ.jpg`}
            alt="Dr. Christian Ferreira"
          />

          <h1 className="name">
            Christian Ferreira
            <VerifiedBadge />
          </h1>

          <p className="tagline">
            Viva o poder da transformação, através da cirurgia plástica.
          </p>

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

          <p className="footer">© Christian Ferreira</p>
        </div>
      </main>
    </>
  );
}
