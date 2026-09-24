"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, Observer, useGSAP } from "../lib/gsap";
import { lenisRef, semMovimento, useReveal } from "../hooks/anima";
import { prepararTique, tocarTique } from "../lib/tique";
import { enviarLead } from "../lib/lead";
import { Olho, Selo } from "../components/base";
import {
  base,
  CRM,
  DEPOIMENTOS,
  DUVIDAS,
  VIDEOS_DEPOIMENTO,
  img,
  MORADA,
  NAV,
  NOMES_PROCEDIMENTOS,
  PROCEDIMENTOS,
  TELEFONE,
  WHATSAPP,
} from "../dados";

/* --- roleta de especialidades -------------------------------------------- */

/* Geometria da roda: os nomes assentam num arco cujo centro fica RADIUS à
   esquerda, então o item activo avança e os vizinhos recuam curvando. Igual ao
   que o site da Lumivie faz nas especialidades. */
const RADIO = 440;
const PASSO_PARADO = 0.11;
const PASSO_ABERTO = 0.17;

export function Roleta() {
  const scope = useRef<HTMLElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const itens = useRef<(HTMLHeadingElement | null)[]>([]);
  const [activo, setActivo] = useState(0);
  // Sem movimento (ou sem JS de animação) a roda não tem como se posicionar:
  // os nomes ficariam todos empilhados na origem. Nesse caso ela vira lista.
  const [estatico, setEstatico] = useState(false);
  const N = PROCEDIMENTOS.length;

  useEffect(() => {
    if (semMovimento()) setEstatico(true);
  }, []);

  useGSAP(
    () => {
      const alvo = palco.current;
      if (!alvo || semMovimento()) return;

      const st = {
        alvo: 0,
        actual: 0,
        passoAlvo: PASSO_PARADO,
        passo: PASSO_PARADO,
      };
      let parar: number | null = null;
      let ultimo = -1;
      let mexeu = false;
      let demo: gsap.core.Timeline | null = null;

      // Um tique a cada item que passa pelo ponteiro, como no site da Lumivie.
      // Os bytes vêm quando o browser está ocioso e o som só se destranca no
      // primeiro gesto real: roda de rato não conta como gesto para o browser.
      prepararTique(`${base}/rolltick.mp3`, 0.35);

      const toque = window.matchMedia("(hover: none)").matches;
      // O toque precisa de mais deslocamento por gesto do que a roda do rato,
      // e no sentido inverso para o arrasto parecer natural.
      const FACTOR = toque ? -0.015 : 0.0055;

      const observer = Observer.create({
        target: alvo,
        type: "wheel,touch",
        preventDefault: true,
        onChangeY(self) {
          if (!mexeu) {
            mexeu = true;
            demo?.kill();
          }
          st.alvo += self.deltaY * FACTOR;
          st.passoAlvo = PASSO_ABERTO;
          if (parar) clearTimeout(parar);
          parar = window.setTimeout(() => {
            st.passoAlvo = PASSO_PARADO;
            st.alvo = Math.round(st.alvo); // encaixa sempre num item
          }, 280);
        },
      });

      const tick = () => {
        st.actual += (st.alvo - st.actual) * 0.055;
        st.passo += (st.passoAlvo - st.passo) * 0.06;

        itens.current.forEach((el, i) => {
          if (!el) return;
          let off = i - st.actual;
          off = ((((off + N / 2) % N) + N) % N) - N / 2;
          const a = off * st.passo;
          const x = -RADIO * (1 - Math.cos(a));
          const y = RADIO * Math.sin(a);
          const rot = (a * 180) / Math.PI;
          const perto = Math.abs(off) < 0.5;
          el.style.transform = `translateY(-50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${
            perto ? 1.16 : 1
          })`;
          el.style.opacity = String(gsap.utils.clamp(0.05, 1, 1 - Math.abs(y) / 340));
          el.classList.toggle("ativo", perto);
        });

        const arredondado = ((Math.round(st.actual) % N) + N) % N;
        if (arredondado !== ultimo) {
          if (ultimo !== -1) tocarTique(); // silencia a primeira atribuição
          ultimo = arredondado;
          setActivo(arredondado);
        }
      };
      gsap.ticker.add(tick);

      // Um empurrão de demonstração quando a seção entra: sem ele ninguém
      // percebe que a roda gira.
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting || e.intersectionRatio < 0.5 || mexeu) return;
          demo = gsap
            .timeline()
            .to(st, {
              alvo: 1,
              passoAlvo: PASSO_ABERTO,
              duration: 0.9,
              ease: "sine.inOut",
            })
            .to(
              st,
              {
                alvo: 0,
                passoAlvo: PASSO_PARADO,
                duration: 1.1,
                ease: "sine.inOut",
              },
              "+=0.2"
            );
          io.disconnect();
        },
        { threshold: [0.5] }
      );
      if (scope.current) io.observe(scope.current);

      return () => {
        gsap.ticker.remove(tick);
        observer.kill();
        io.disconnect();
        demo?.kill();
        if (parar) clearTimeout(parar);
      };
    },
    { scope }
  );

  // A seção captura o gesto vertical no telemóvel, então precisa de uma saída
  // explícita para a seção seguinte.
  function seguinte() {
    const proxima = scope.current?.nextElementSibling as HTMLElement | null;
    if (!proxima) return;
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(proxima, { duration: 0.9 });
    else proxima.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section
      className="roleta-secao sobre-foto"
      ref={scope}
      id="procedimentos"
      data-estatico={estatico ? "1" : ""}
    >
      {/* Uma foto por procedimento, e não fotos de ambiente: quem lê
          "Abdominoplastia" precisa de ver do que se trata, não de mais um
          corredor de hospital. */}
      <div className="roleta-fundos">
        {PROCEDIMENTOS.map((p, i) => (
          <img
            key={p.foto}
            src={img(p.foto)}
            alt=""
            aria-hidden
            loading="lazy"
            data-ativa={i === activo ? "1" : ""}
          />
        ))}
      </div>
      <div className="roleta-veu" aria-hidden />

      <div className="roleta-corpo faixa">
        <div>
          <Olho>Especialidades</Olho>
          <h2 className="d3" style={{ margin: "1.1rem 0 0.6rem", maxWidth: "22ch" }}>
            Especialidades que <span className="italico">definem resultados</span>
          </h2>
          <p className="roleta-desc">{PROCEDIMENTOS[activo].texto}</p>
        </div>

        <div
          className="roleta-palco"
          ref={palco}
          data-lenis-prevent
          data-cursor
          data-cursor-rotulo="Role"
        >
          <span className="roleta-marca" aria-hidden />
          <div className="roleta-origem">
            {PROCEDIMENTOS.map((p, i) => (
              <h3
                key={p.nome}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                className="roleta-item"
              >
                {p.nome}
              </h3>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={seguinte}
        aria-label="Seção seguinte"
        className="roleta-saida"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

/* --- depoimentos ---------------------------------------------------------- */

/** Fachada de vídeo: até ao clique só existe o cartaz, e nenhum byte sai para o
 *  YouTube. O iframe (e todo o rasto que ele traz) só entra quando alguém pede
 *  para ver. Os vídeos vêm do canal do Dr. Christian. */
function VideoDepoimento({
  v,
}: {
  v: { foto: string; id: string; nome: string; alt: string };
}) {
  const [tocando, setTocando] = useState(false);

  return (
    <figure className="depo-video" data-tocando={tocando ? "1" : ""}>
      <div className="depo-quadro">
        {tocando ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title="Depoimento de paciente do Dr. Christian Ferreira"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setTocando(true)}
            aria-label="Reproduzir o depoimento em vídeo"
          >
            <img src={img(v.foto)} alt={v.alt} loading="lazy" />
            <i aria-hidden>
              <svg width="16" height="19" viewBox="0 0 16 19" aria-hidden>
                <path d="M15 9.5 0 19V0l15 9.5Z" fill="currentColor" />
              </svg>
            </i>
          </button>
        )}
      </div>
      <figcaption>
        {v.nome && <b>{v.nome}</b>}
        Depoimento em vídeo
      </figcaption>
    </figure>
  );
}

export function Depoimentos() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="depoimentos marfim" ref={scope} id="depoimentos">
      <div className="faixa">
        <Olho>Depoimentos</Olho>
        <h2 className="d2" data-split style={{ margin: "1.4rem 0 1.1rem" }}>
          Resultados que <span className="italico">falam por si</span>
        </h2>
        <p className="lead medida" data-reveal="0.1">
          Pacientes do Dr. Christian, nos depoimentos gravados no consultório.
        </p>

        <div className="depo-videos">
          {VIDEOS_DEPOIMENTO.map((v, i) => (
            <div key={v.foto} data-reveal={0.08 * i}>
              <VideoDepoimento v={v} />
            </div>
          ))}
        </div>

        <div className="depoimentos-grade">
          {DEPOIMENTOS.map((d, i) => (
            <article className="depoimento" key={d.nome} data-reveal={0.08 * i}>
              <blockquote>“{d.texto}”</blockquote>
              <footer>
                {d.nome}
                <span>{d.proc}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- FAQ com o CTA a subir por cima -------------------------------------- */

export function Faq() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <section className="faq travertino" id="duvidas">
      <div className="faixa">
        <Olho>Dúvidas frequentes</Olho>
        <h2 className="d2" style={{ marginTop: "1.4rem" }}>
          As perguntas de quem <span className="italico">vem de fora</span>
        </h2>

        <div className="faq-lista">
          {DUVIDAS.map((d, i) => (
            <div className="faq-item" key={d.p} data-aberto={aberto === i ? "1" : ""}>
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  aria-expanded={aberto === i}
                  onClick={() => setAberto(aberto === i ? null : i)}
                >
                  {d.p}
                  <i aria-hidden />
                </button>
              </h3>
              <div className="faq-resposta">
                <div>
                  <p>{d.r}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* O navegador não valida `type="tel"`: aceita qualquer coisa. A única garantia
   de que o número serve para chamar a paciente de volta é contar os algarismos.
   Oito é o piso, porque um fixo de Maputo tem oito e um telemóvel tem nove; com
   indicativo do país passa de doze. A mensagem é limpa a cada tecla, senão fica
   presa depois de a pessoa corrigir. */
function validarTelefone(e: React.FormEvent<HTMLInputElement>) {
  const campo = e.currentTarget;
  const algarismos = campo.value.replace(/\D/g, "").length;
  campo.setCustomValidity(
    algarismos === 0 || algarismos >= 8
      ? ""
      : "Escreva o número completo, com o indicativo do país."
  );
}

function Formulario() {
  const [enviando, setEnviando] = useState(false);

  /* Regista o lead no webhook e só depois encaminha para o WhatsApp, na mesma
     ordem do formulário da Lumivie. O envio tem timeout curto e nunca atira:
     um serviço de terceiro lento ou fora do ar não pode prender a paciente
     nesta página.

     A mensagem deixou de ir pré-escrita porque o link de rastreio da Tintim
     não aceita `?text=` — quem leva o contexto agora é o webhook. */
  async function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setEnviando(true);

    await enviarLead({
      nome: String(d.get("nome") ?? ""),
      email: String(d.get("email") ?? ""),
      telefone: String(d.get("telefone") ?? ""),
      cidade: String(d.get("cidade") ?? ""),
      procedimento: String(d.get("procedimento") ?? ""),
      mensagem: String(d.get("mensagem") ?? ""),
    });

    window.location.href = WHATSAPP;
  }

  return (
    <form className="formulario" onSubmit={submeter}>
      <div className="dois">
        <div className="campo">
          <label htmlFor="nome">O seu nome</label>
          <input id="nome" name="nome" required autoComplete="name" />
        </div>
        <div className="campo">
          <label htmlFor="cidade">Cidade e país</label>
          <input
            id="cidade"
            name="cidade"
            required
            placeholder="Maputo, Moçambique"
            autoComplete="address-level2"
          />
        </div>
      </div>
      <div className="dois">
        <div className="campo">
          <label htmlFor="email">O seu e-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nome@exemplo.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div className="campo">
          <label htmlFor="telefone">Telemóvel com WhatsApp</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            required
            placeholder="+258 84 000 0000"
            autoComplete="tel"
            inputMode="tel"
            onInput={validarTelefone}
          />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="procedimento">O que gostaria de tratar</label>
        <select
          id="procedimento"
          name="procedimento"
          defaultValue={NOMES_PROCEDIMENTOS[0]}
        >
          {NOMES_PROCEDIMENTOS.map((p) => (
            <option key={p}>{p}</option>
          ))}
          <option>Quero orientação sobre o meu caso</option>
        </select>
      </div>
      <div className="campo">
        <label htmlFor="mensagem">Algo que queira contar antes (opcional)</label>
        <textarea id="mensagem" name="mensagem" rows={3} />
      </div>
      <button className="btn btn-claro" type="submit" disabled={enviando}>
        <span className="brilho" aria-hidden />
        {enviando ? "A abrir o WhatsApp…" : "Agendar o meu Lumivie Day"}
      </button>
      <p className="aviso">
        Ao enviar, a conversa abre no WhatsApp com a consultora do Dr. Christian
        e os seus dados seguem para a equipa. Atendimento de segunda a sexta, das
        14h às 24h de Maputo, e ao sábado das 14h às 17h.
      </p>
    </form>
  );
}

export function Cta() {
  const scope = useReveal<HTMLElement>();

  return (
    <section className="cta petroleo" ref={scope} id="contacto">
      <div className="faixa cta-grade">
        <div>
          <Olho>Lumivie Day</Olho>
          <h2 className="d2" data-split style={{ margin: "1.4rem 0 1.3rem" }}>
            O lugar certo para você{" "}
            <span className="italico">se reconhecer no espelho</span>
          </h2>
          <p className="lead medida" data-reveal="0.12">
            Agende o seu Lumivie Day com o Dr. Christian Ferreira. Uma avaliação
            individual, um planeamento feito para o seu corpo e acompanhamento
            que segue até a recuperação completa.
          </p>
          <p
            className="assinada"
            data-reveal="0.18"
            style={{ fontSize: "2.6rem", marginTop: "1.8rem", color: "var(--travertino)" }}
          >
            A sua transformação começa aqui.
          </p>
          <div
            data-reveal="0.24"
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "0.4rem",
              fontSize: "0.95rem",
              opacity: 0.8,
            }}
          >
            <span>WhatsApp {TELEFONE}</span>
            <span>{MORADA}</span>
          </div>
        </div>

        <div data-reveal="0.12">
          <Formulario />
        </div>
      </div>
    </section>
  );
}

/* O FAQ chegou a ficar preso na tela com o CTA subindo por cima, como no
   fecho do site da Lumivie. Foi desfeito: com uma resposta longa aberta, o
   texto passava do fundo da janela e não havia como rolar até ele, porque o
   próprio scroll trazia o CTA por cima. Aqui a leitura vale mais que o efeito. */
export function Fecho() {
  return (
    <>
      <Faq />
      <Cta />
    </>
  );
}

/* --- rodapé --------------------------------------------------------------- */

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="faixa">
        <div className="rodape-topo">
          <div>
            <img
              className="marca-rodape"
              src={`${base}/assinatura-preta.png`}
              alt="Dr. Christian Ferreira"
              width={220}
              height={60}
              loading="lazy"
            />
            <p style={{ marginTop: "1.3rem", opacity: 0.7, maxWidth: "38ch" }}>
              Cirurgia plástica de alto padrão em São Paulo, para pacientes de
              Moçambique e do resto do mundo.
            </p>
          </div>
          <div>
            <h4>Contacto</h4>
            <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.95rem" }}>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                WhatsApp {TELEFONE}
              </a>
              <span style={{ opacity: 0.7 }}>{MORADA}</span>
            </div>
          </div>
          <div>
            <h4>Seções</h4>
            <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.95rem" }}>
              {NAV.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.texto}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="rodape-base">
          <span>Dr. Christian Ferreira · {CRM}</span>
          <span>
            Os resultados variam de pessoa para pessoa. Toda a cirurgia tem
            riscos, avaliados individualmente em consulta.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* --- barra fixa no telemóvel --------------------------------------------- */

export function Barra() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let tick = 0;
    const passo = () => {
      tick = 0;
      el.dataset.visivel = window.scrollY > window.innerHeight * 0.9 ? "1" : "";
    };
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
    <div className="barra" ref={ref}>
      <a className="btn btn-claro" href="#contacto">
        Agendar Lumivie Day
      </a>
      <a
        className="btn"
        style={{ flex: "0 0 auto", color: "var(--marfim)" }}
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Selo className="selo-olho" />
        WhatsApp
      </a>
    </div>
  );
}
