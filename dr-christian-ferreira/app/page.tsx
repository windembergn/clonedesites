import WarpTuner from "./WarpTuner";
import Tracker from "./Tracker";

// Cards (imagem = link). A ordem e os links replicam o site original.
const cards = [
  {
    img: "/cards/card1.jpg",
    href:
      "https://tintim.link/whatsapp/5880db1a-90a2-495e-9a51-27dc9c28bc7e/6808c946-5020-45e7-9152-4f77660857f9",
    label: "Agende sua consulta",
  },
  {
    img: "/cards/card2.jpg",
    href: "https://drchristianferreira.com.br/",
    label: "Conheça o Dr. Christian Ferreira",
  },
  {
    img: "/cards/card3.jpg",
    href: "https://www.youtube.com/@drchristianferreira",
    label: "YouTube do Dr. Christian Ferreira",
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
      {/* Fundo animado (shader Warp) — paleta final escolhida pelo usuário no ajuste ao vivo.
          WarpTuner acrescenta o painel de ajuste ao vivo (abra com ?tune ou Shift+C). */}
      <Tracker site="link-christian" />

      <WarpTuner c1="#9a8160" c2="#ddcebb" c3="#927655" speed={0.3} />

      <main className="page">
        <div className="column">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="avatar"
            src="/avatar.jpg"
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
