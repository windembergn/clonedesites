"use client";

/* Peças pequenas que aparecem em várias seções. */

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "../lib/gsap";
import { noToque, semMovimento } from "../hooks/anima";

/* Os botões não perseguem o cursor. A única reação ao rato é a cor, que sobe
   por baixo do rótulo. Foi decisão do cliente, e ajuda: num formulário, alvo
   que foge é alvo que se erra. */

/* --- selo gráfico --------------------------------------------------------- */

/** Estrela de quatro pontas do repertório da marca, usada para pontuar rótulos.
 *  Gira devagar o suficiente para ser notada só depois de olhar duas vezes. */
export function Selo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path
        d="M12 0c.6 6.4 5 10.8 12 12-7 1.2-11.4 5.6-12 12-.6-6.4-5-10.8-12-12C7 10.8 11.4 6.4 12 0Z"
        fill="currentColor"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="26s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

/* --- rótulo de seção ------------------------------------------------------ */

export function Olho({ children }: { children: ReactNode }) {
  return (
    <p className="olho" data-reveal>
      <Selo className="selo-olho" />
      {children}
    </p>
  );
}

/* --- cursor --------------------------------------------------------------- */

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || noToque() || semMovimento()) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    document.documentElement.classList.add("cursor-proprio");
    const x = gsap.quickTo(el, "x", { duration: 0.42, ease: "power3" });
    const y = gsap.quickTo(el, "y", { duration: 0.42, ease: "power3" });

    function mover(e: PointerEvent) {
      x(e.clientX);
      y(e.clientY);
      el!.dataset.vivo = "1";
      const alvo = (e.target as HTMLElement)?.closest<HTMLElement>(
        "a, button, [data-cursor]"
      );
      const rotulo = alvo?.dataset.cursorRotulo;
      el!.dataset.alvo = rotulo ? "rotulo" : alvo ? "link" : "";
      el!.textContent = rotulo ?? "";
    }
    function sair() {
      el!.dataset.vivo = "";
    }

    window.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", sair);
    return () => {
      document.documentElement.classList.remove("cursor-proprio");
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", sair);
    };
  }, []);

  return <div ref={ref} className="cursor" aria-hidden />;
}

/* --- barra de progresso --------------------------------------------------- */

export function Progresso() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
    });
  }, []);

  return (
    <div className="progresso" aria-hidden>
      <i ref={ref as React.RefObject<HTMLElement>} />
    </div>
  );
}

/* --- faixa correndo ------------------------------------------------------- */

/** A velocidade e o sentido reagem ao scroll, como no site da Lumivie: a faixa
 *  acelera quando a pessoa rola depressa e inverte quando ela volta. */
export function Faixa({
  itens,
  duracao = 34,
  className = "",
}: {
  itens: string[];
  duracao?: number;
  className?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const trilho = scope.current?.querySelector<HTMLElement>("[data-trilho]");
      if (!trilho || semMovimento()) return;

      const loop = gsap.to(trilho, {
        xPercent: -50,
        ease: "none",
        duration: duracao,
        repeat: -1,
      });

      const st = ScrollTrigger.create({
        trigger: scope.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate(self) {
          const impulso = gsap.utils.clamp(
            0,
            4,
            Math.abs(self.getVelocity()) / 300
          );
          gsap.to(loop, {
            timeScale: (self.direction || 1) * (1 + impulso),
            duration: 0.3,
            overwrite: true,
          });
        },
      });
      return () => st.kill();
    },
    { scope }
  );

  // Duas passagens iguais: o loop anda -50%, então a segunda entra exatamente
  // onde a primeira sai e a emenda não aparece.
  const passagem = (chave: string, principal: boolean) => (
    <div
      key={chave}
      aria-hidden={principal ? undefined : true}
      className="faixa-seq"
    >
      {itens.map((it) => (
        <span key={it} className="faixa-item">
          {it}
          <Selo className="faixa-selo" />
        </span>
      ))}
    </div>
  );

  return (
    <div ref={scope} className={`faixa-correndo ${className}`}>
      <div data-trilho className="faixa-trilho">
        {passagem("a", true)}
        {passagem("b", false)}
      </div>
    </div>
  );
}
