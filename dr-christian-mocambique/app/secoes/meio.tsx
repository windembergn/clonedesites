"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "../lib/gsap";
import { semMovimento, useParallax, useReveal } from "../hooks/anima";
import { Olho } from "../components/base";
import {
  CRM,
  GALERIA_CLINICA,
  GALERIA_HOSPITAL,
  img,
  JORNADA,
  MORADA,
  PADRAO,
} from "../dados";

/* --- o médico ------------------------------------------------------------- */

export function Medico() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="medico marfim" ref={scope} id="medico">
      <div className="medico-foto">
        <img
          src={img("christian-3")}
          alt="Dr. Christian Ferreira no consultório"
          loading="lazy"
        />
      </div>

      <div className="medico-texto">
        <Olho>Sobre o médico</Olho>
        <h2 className="d2" data-split>
          Conheça o Dr. <span className="italico">Christian Ferreira</span>
        </h2>
        <p
          className="assinada"
          data-reveal="0.1"
          style={{ fontSize: "2.3rem", color: "var(--argila)" }}
        >
          O extraordinário começa em você.
        </p>
        <p className="lead" data-reveal="0.15">
          Cirurgião plástico com mais de 10 anos de experiência, mentor de
          cirurgiões, especialista em contorno corporal, mamas e abdómen.
        </p>
        <p data-reveal="0.2" style={{ opacity: 0.82 }}>
          Egresso do serviço de Cirurgia Plástica da FMABC/SP, é membro da
          Sociedade Brasileira de Cirurgia Plástica (SBCP) e da Brazilian
          Association of Plastic Surgeons (BAPS). Ao longo da carreira
          desenvolveu protocolos de recuperação acelerada, como a Prótese de
          Mama R24R e a Abdominoplastia de Recuperação Rápida, que tornaram a
          sua actuação referência técnica no Brasil.
        </p>
        <p data-reveal="0.25" style={{ opacity: 0.82 }}>
          Além da prática clínica, forma profissionais com base nos seus
          próprios protocolos e padrões de excelência.
        </p>
        <div className="credenciais" data-reveal="0.3">
          <span>{CRM}</span>
          <span>SBCP e BAPS</span>
          <span>FMABC/SP</span>
        </div>
      </div>
    </section>
  );
}

/* --- o padrão (três pilares) --------------------------------------------- */

export function Padrao() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="padrao travertino" ref={scope}>
      <div className="faixa">
        <Olho>Benefícios</Olho>
        <h2 className="d2" data-split style={{ margin: "1.4rem 0 1.2rem" }}>
          O que define o padrão <span className="italico">Dr. Christian Ferreira</span>
        </h2>
        <p className="lead medida" data-reveal="0.12">
          Cada etapa da jornada foi desenhada para que a experiência cirúrgica
          seja a melhor possível, antes, durante e depois.
        </p>

        <div className="padrao-grade">
          {PADRAO.map((p, i) => (
            <article className="pilar" key={p.n} data-reveal={0.1 * i}>
              <img src={img(p.foto)} alt="" aria-hidden loading="lazy" />
              <b>{p.n}</b>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- galeria fixada com rolagem horizontal ------------------------------- */

/** No desktop a seção prende na tela e o scroll vertical passa a empurrar a
 *  tira para o lado, que é o gesto do site da Lumivie. No telemóvel a fixação
 *  sai de cena e a tira volta a ser um arrastar normal com o dedo. */
export function GaleriaPin({
  id,
  olho,
  titulo,
  italico,
  texto,
  itens,
  altos,
}: {
  id?: string;
  olho: string;
  titulo: string;
  italico: string;
  texto: string;
  itens: { src: string; legenda: string; alt: string }[];
  altos?: string[];
}) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const secao = scope.current;
      const trilho = secao?.querySelector<HTMLElement>("[data-trilho-h]");
      if (!secao || !trilho) return;
      if (semMovimento()) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px)", () => {
        const distancia = () => trilho.scrollWidth - window.innerWidth;
        const tween = gsap.to(trilho, {
          x: () => -distancia(),
          ease: "none",
          scrollTrigger: {
            trigger: secao,
            start: "top top",
            // O comprimento do pin acompanha a largura real da tira: assim a
            // última foto chega exactamente quando a seção se solta.
            end: () => `+=${distancia()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            // Sem `anticipatePin`. Ele prende a seção um pouco antes da hora,
            // com base na velocidade do scroll, e o Lenis entrega uma
            // velocidade suavizada: a estimativa saía errada e a página dava um
            // salto para a galeria e voltava.
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope }
  );

  return (
    <section className="galeria-pin" ref={scope} id={id}>
      <div className="galeria-palco">
        <div className="galeria-trilho" data-trilho-h>
          <div className="galeria-intro">
            <Olho>{olho}</Olho>
            <h2 className="d2">
              {titulo} <span className="italico">{italico}</span>
            </h2>
            <p style={{ opacity: 0.8 }}>{texto}</p>
          </div>

          {itens.map((it) => (
            <figure
              className={`galeria-item${
                altos?.includes(it.src) ? " alto" : ""
              }`}
              key={it.src}
            >
              <div className="quadro">
                <img src={img(it.src)} alt={it.alt} loading="lazy" />
              </div>
              <figcaption>{it.legenda}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <p className="galeria-dica" aria-hidden>
        <svg viewBox="0 0 34 8" fill="none">
          <path d="M0 4h32M28 1l4 3-4 3" stroke="currentColor" strokeWidth="1" />
        </svg>
        Arraste para o lado
      </p>
    </section>
  );
}

export function Hospital() {
  return (
    <GaleriaPin
      id="hospital"
      olho="Onde a cirurgia acontece"
      titulo="Blanc Hospital,"
      italico="São Paulo"
      texto="Bloco cirúrgico completo, cuidados intensivos, equipa assistencial própria e uma hotelaria com suítes de internamento, concierge, mordomo e gastronomia assinada por chef. Para quem chega de Moçambique com um acompanhante, o conforto das primeiras 48 horas pesa tanto quanto a sala cirúrgica."
      itens={GALERIA_HOSPITAL}
      altos={["blanc-mimos"]}
    />
  );
}

/** O consultório vem em mosaico sangrado, e não numa segunda tira presa: duas
 *  galerias horizontais seguidas cansariam, e aqui interessa ver o conjunto de
 *  uma vez, não percorrer foto a foto. */
export function Clinica() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="consultorio marfim" ref={scope} id="clinica">
      <div className="faixa consultorio-cabeca">
        <Olho>Onde você será recebida</Olho>
        <h2 className="d2" data-split>
          O consultório, <span className="italico">em Moema</span>
        </h2>
        <p className="lead medida" data-reveal="0.12">
          A avaliação presencial da véspera e os retornos acontecem aqui, na{" "}
          {MORADA}. Um espaço pequeno de propósito, para receber poucas pessoas
          por dia e dar a cada uma o tempo que a decisão exige.
        </p>
      </div>

      <div className="mosaico">
        {GALERIA_CLINICA.map((it, i) => (
          <figure key={it.src} data-reveal={0.06 * i}>
            <img src={img(it.src)} alt={it.alt} loading="lazy" />
            <figcaption>{it.legenda}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* --- moema ---------------------------------------------------------------- */

export function Moema() {
  const scope = useParallax<HTMLElement>();

  return (
    <section className="moema travertino" ref={scope}>
      <div className="moema-foto">
        <img
          data-parallax="-0.06"
          src={img("moema-janela")}
          alt="Vista de Moema a partir do consultório"
          loading="lazy"
          style={{ height: "112%", marginTop: "-6%" }}
        />
      </div>

      <div className="moema-texto">
        <Olho>A cidade</Olho>
        <h2 className="d2" data-split>
          São Paulo, e dentro dela <span className="italico">Moema</span>
        </h2>
        <p className="lead" data-reveal="0.12">
          Maior cidade da América Latina e maior economia do Brasil. É onde
          estão os hospitais de referência, os centros de formação e os
          equipamentos que chegam primeiro ao país.
        </p>
        <p data-reveal="0.18" style={{ opacity: 0.84 }}>
          O consultório fica em Moema, uma das zonas mais nobres de São Paulo.
          Arborizada, tranquila, com hotelaria e restaurantes a poucos minutos a
          pé e perto do hospital onde a cirurgia acontece. Para quem chega de
          fora com um acompanhante, isso simplifica a estadia inteira.
        </p>
      </div>
    </section>
  );
}

/* --- jornada (Dream Day) -------------------------------------------------- */

/** A rota Maputo → São Paulo desenha-se conforme a lista avança. É o único
 *  desenho animado da página, e existe porque a jornada é exactamente o que
 *  este público precisa de visualizar antes de decidir. */
function Rota() {
  const ref = useRef<SVGPathElement>(null);

  useGSAP(() => {
    const linha = ref.current;
    if (!linha || semMovimento()) return;
    const comprimento = linha.getTotalLength();
    gsap.set(linha, {
      strokeDasharray: comprimento,
      strokeDashoffset: comprimento,
    });
    gsap.to(linha, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: linha.closest(".jornada-corpo"),
        start: "top 72%",
        // Termina quando o fim da lista chega à metade da tela, e não ao pé
        // dela: o traço passa a preencher ao longo de toda a leitura, devagar.
        end: "bottom 55%",
        scrub: 1.4,
      },
    });
  }, []);

  const d = "M20 0 C 4 60, 36 120, 20 180 C 6 240, 32 300, 20 360";

  /* Os marcos são HTML, e não <text> dentro do SVG, porque o desenho estica
     na vertical para acompanhar a lista (preserveAspectRatio="none") e
     esticaria a tipografia junto. */
  return (
    <div className="jornada-rota" aria-hidden>
      <span className="rota-marco">Maputo</span>
      <svg viewBox="0 0 40 360" preserveAspectRatio="none" role="presentation">
        {/* Sem `non-scaling-stroke`: com ele o tracejado é calculado no espaço
            já escalado, enquanto getTotalLength() devolve unidades do viewBox.
            As duas medidas não batiam e o traço aparecia preenchido pelo meio.
            A escala em x (3,2x) e em y (3,5x) é quase a mesma, então a linha
            não deforma; basta nascer mais fina. */}
        <path className="rota-fundo" d={d} />
        <path className="rota-linha" ref={ref} d={d} />
      </svg>
      <span className="rota-marco">São Paulo</span>
    </div>
  );
}

export function Jornada() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="jornada marfim" ref={scope} id="jornada">
      <div className="faixa">
        <Olho>A jornada</Olho>
        <h2 className="d2" data-split style={{ margin: "1.4rem 0 1.2rem" }}>
          Do primeiro contacto <span className="italico">ao regresso a casa</span>
        </h2>
        <p className="lead medida" data-reveal="0.12">
          Tudo começa no Dream Day, a sua primeira consulta com o Dr. Christian.
          Uma videochamada de hora e meia a duas horas dedicada ao seu caso,
          para ouvir os seus objectivos, avaliar a sua anatomia e construir o
          planeamento cirúrgico.
        </p>

        <div className="jornada-corpo">
          <Rota />

          <ol className="etapas">
            {JORNADA.map((e) => (
              <li className="etapa" key={e.n} data-reveal>
                <b>{e.n}</b>
                <h3>{e.titulo}</h3>
                <p>{e.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
