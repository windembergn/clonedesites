"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, SplitText } from "../lib/gsap";
import {
  semMovimento,
  useContador,
  useParallax,
  useReveal,
} from "../hooks/anima";
import { Faixa, Olho, Selo } from "../components/base";
import {
  base,
  CRM,
  FAIXA_PROVA,
  img,
  NAV,
  NUMEROS,
  WHATSAPP,
} from "../dados";

/* --- navbar --------------------------------------------------------------- */

export function Navbar() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let tick = 0;
    // A barra fica sempre visível, só troca de pele depois do hero. O
    // esconde-e-mostra por direção de scroll dava saltos nas seções presas: o
    // pin do ScrollTrigger mexe no scroll para compensar o espaçador, e cada
    // correção dessas era lida como uma mudança de direção.
    function passo() {
      tick = 0;
      el!.dataset.solido =
        window.scrollY > window.innerHeight * 0.85 ? "1" : "";
    }
    const agenda = () => {
      if (!tick) tick = requestAnimationFrame(passo);
    };
    window.addEventListener("scroll", agenda, { passive: true });
    passo();
    return () => {
      window.removeEventListener("scroll", agenda);
      if (tick) cancelAnimationFrame(tick);
    };
  }, []);

  return (
    <header className="navbar" ref={ref}>
      <a href="#topo" aria-label="Dr. Christian Ferreira, início da página">
        <img
          className="marca"
          src={`${base}/assinatura-preta.png`}
          alt="Dr. Christian Ferreira"
          width={220}
          height={60}
        />
      </a>
      <nav aria-label="Seções">
        {NAV.map((l) => (
          <a key={l.href} href={l.href}>
            {l.texto}
          </a>
        ))}
      </nav>
      <a className="btn" href="#contacto">
        Agendar Dream Day
      </a>
    </header>
  );
}

/* --- hero ----------------------------------------------------------------- */

export function Hero() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(scope);
      if (semMovimento()) return;

      const titulo = q("h1")[0] as HTMLElement;
      const corte = SplitText.create(titulo, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        // Ver a nota em hooks/anima.ts: sem isto o H1 fica vazio para quem lê
        // a estrutura da página.
        aria: "none",
      });

      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(
          "[data-hero-foto]",
          { scale: 1.14 },
          { scale: 1, duration: 1.9 },
          0
        )
        .from(
          corte.lines,
          { yPercent: 118, duration: 1.15, stagger: 0.1 },
          0.35
        )
        .from(
          "[data-hero-sobe]",
          { y: 32, autoAlpha: 0, duration: 1, stagger: 0.11 },
          0.6
        );

      // A foto continua a deslizar enquanto o hero sai da tela.
      gsap.to("[data-hero-foto]", {
        yPercent: 10,
        ease: "none",
        scrollTrigger: {
          trigger: scope.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      return () => corte.revert();
    },
    { scope }
  );

  return (
    <section className="hero sobre-foto" ref={scope} id="topo">
      <div className="hero-foto">
        <img
          data-hero-foto
          src={img("christian-hero")}
          alt="Dr. Christian Ferreira, cirurgião plástico"
          fetchPriority="high"
          width={817}
          height={1200}
        />
      </div>
      <div className="hero-veu" aria-hidden />
      <div className="grao" aria-hidden />

      <div className="hero-conteudo faixa">
        <p className="olho" data-hero-sobe>
          <Selo className="selo-olho" />
          Pacientes internacionais, Moçambique
        </p>

        <h1 className="d1">
          Cirurgia plástica de alto padrão com resultados que{" "}
          <span className="italico">respeitam quem você é</span>
        </h1>

        <p className="lead medida" data-hero-sobe>
          Mais de 10 anos de experiência, mais de 4.000 cirurgias realizadas e
          protocolos próprios de recuperação rápida. A preparação acontece à
          distância, a partir de Moçambique, e a cirurgia no Blanc Hospital, em
          São Paulo.
        </p>

        <div className="hero-acoes" data-hero-sobe>
          <a className="btn btn-claro" href="#contacto">
            <span className="brilho" aria-hidden />
            Agendar o meu Dream Day
          </a>
          <a className="btn" href="#video">
            Ver o vídeo
          </a>
        </div>

        <div className="hero-selos" data-hero-sobe>
          <span>SBCP e BAPS</span>
          <span>{CRM}</span>
          <span>Mais de 4.000 cirurgias</span>
          <span>Moema, São Paulo</span>
        </div>
      </div>

      <span className="hero-rolar" aria-hidden>
        Role
      </span>
    </section>
  );
}

/* --- prova / números ------------------------------------------------------ */

function Numero({
  valor,
  prefixo,
  sufixo,
  rotulo,
}: {
  valor: number;
  prefixo?: string;
  sufixo?: string;
  rotulo: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useContador(ref, valor);
  return (
    <div className="numero" data-reveal>
      <b>
        {prefixo}
        <span ref={ref}>0</span>
        {sufixo}
      </b>
      <span>{rotulo}</span>
    </div>
  );
}

export function Prova() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="prova escuro" ref={scope}>
        <div className="faixa">
          <div className="prova-topo">
            <div>
              <Olho>Porque São Paulo</Olho>
              <h2 className="d2" data-split style={{ marginTop: "1.4rem" }}>
                O Brasil é o segundo país que mais realiza cirurgia plástica no
                mundo, atrás apenas dos Estados Unidos.
              </h2>
            </div>
            <p className="lead" data-reveal="0.15">
              A referência está nas técnicas avançadas, na tecnologia e nos
              protocolos de segurança. São Paulo, a maior cidade da América
              Latina e a maior economia do país, concentra os hospitais e os
              equipamentos que chegam primeiro ao Brasil. Pacientes de África,
              da Europa e dos Emirados operam aqui com o Dr. Christian.
            </p>
          </div>

          <div className="numeros">
            {NUMEROS.map((n) => (
              <Numero key={n.rotulo} {...n} />
            ))}
          </div>
      </div>
    </section>
  );
}

/** A faixa vive sozinha porque agora entra logo abaixo do hero, antes dos
 *  depoimentos. */
export function FaixaProva() {
  return <Faixa itens={FAIXA_PROVA} />;
}

/* --- vídeo ---------------------------------------------------------------- */

export function Video() {
  const scope = useParallax<HTMLElement>();
  const video = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  const [fonte, setFonte] = useState(`${base}/video/vsl-960.mp4`);

  useEffect(() => {
    // A versão de 1280 px custa 25 MB. Só entra quando há tela e banda que
    // justifiquem: em 3G ou com poupança de dados fica a de 960 px, com 12 MB.
    const con = (
      navigator as unknown as {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;
    const lento =
      con?.saveData || (con?.effectiveType && /2g|3g/.test(con.effectiveType));
    if (!lento && window.innerWidth >= 1024) setFonte(`${base}/video/vsl.mp4`);
  }, []);

  function tocar() {
    setTocando(true);
    // O play tem de sair no mesmo gesto do clique, senão o iOS recusa.
    requestAnimationFrame(() => video.current?.play().catch(() => {}));
  }

  return (
    <section
      className="video-secao sobre-foto"
      ref={scope}
      id="video"
      data-tocando={tocando ? "1" : ""}
    >
      <div className="video-fundo" data-parallax="0.08">
        <video
          ref={video}
          src={fonte}
          poster={img("vsl-poster")}
          controls={tocando}
          playsInline
          preload="none"
          onEnded={() => setTocando(false)}
        />
      </div>
      <div className="video-veu" aria-hidden />
      <div className="grao" aria-hidden />

      {!tocando && (
        <button className="video-play" type="button" onClick={tocar}>
          <i aria-hidden>
            <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden>
              <path d="M19 12 0 24V0l19 12Z" fill="currentColor" />
            </svg>
          </i>
          <span className="sr-only">Reproduzir o vídeo do Dr. Christian</span>
        </button>
      )}

      <div className="video-texto faixa">
        <Olho>O médico fala</Olho>
        <h2 className="d2" data-split style={{ margin: "1.3rem 0 1.1rem" }}>
          Três minutos e meio <span className="italico">com o Dr. Christian</span>
        </h2>
        <p className="lead medida" data-reveal="0.15">
          As razões técnicas, a estrutura hospitalar e o formato do
          acompanhamento à distância, ditos por quem opera.
        </p>
      </div>
    </section>
  );
}
