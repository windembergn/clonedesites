"use client";

/* ---------------------------------------------------------------------------
   Ganchos de animação, no mesmo formato do site da Lumivie: um `scope` que se
   pendura na seção e filhos marcados por atributo.

     data-split   → título revelado linha a linha por trás de uma máscara
     data-reveal  → bloco sobe e aparece
     data-parallax="0.15" → camada que desliza com o scroll

   Tudo desliga com `prefers-reduced-motion`.
--------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "../lib/gsap";

export const semMovimento = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const noToque = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none), (pointer: coarse)").matches;

/** Guarda a instância do Lenis para quem precisar rolar por código. */
export const lenisRef: { current: Lenis | null } = { current: null };

/* --- scroll suave --------------------------------------------------------- */

export function useScrollSuave() {
  useEffect(() => {
    if (semMovimento()) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    // As fontes de título trocam as métricas do texto quando chegam, o que
    // muda a altura do documento e faz o ScrollTrigger recalcular os pins no
    // meio da rolagem. Um refresh explícito assim que elas assentam resolve de
    // uma vez, em vez de um reajuste imprevisível mais tarde.
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Âncoras internas passam a rolar pelo Lenis, senão o salto nativo briga
    // com a interpolação e a página "pisca" no destino.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href^="#"]'
      );
      const id = link?.getAttribute("href");
      if (!id || id === "#") return;
      const alvo = document.querySelector(id);
      if (!alvo) return;
      e.preventDefault();
      lenis.scrollTo(alvo as HTMLElement, { duration: 1.3 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);
}

/* --- reveals por seção ---------------------------------------------------- */

export function useReveal<T extends HTMLElement = HTMLElement>(
  inicio = "top 80%"
) {
  const scope = useRef<T>(null);

  useGSAP(
    () => {
      if (semMovimento()) return;

      gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
        // `aria: "none"` de propósito. Por omissão o SplitText marca cada
        // linha com `aria-hidden` e põe um `aria-label` no título. O texto
        // continua no DOM, mas ferramentas que montam o índice de headings
        // (e auditorias de SEO) mostravam estes títulos VAZIOS. Sem o aria, a
        // linha volta a ser texto comum: nada muda no desenho nem na animação.
          aria: "none",
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 118,
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: inicio },
            });
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        // `data-reveal` sem valor é o caso comum (sem atraso). parseFloat("")
        // devolve NaN, e um delay NaN faz a tween nunca chegar ao fim: o bloco
        // ficava preso em opacity 0.
        const atraso = Number.parseFloat(el.dataset.reveal ?? "");
        gsap.from(el, {
          opacity: 0,
          y: 44,
          duration: 1,
          ease: "power3.out",
          delay: Number.isFinite(atraso) ? atraso : 0,
          scrollTrigger: { trigger: el, start: inicio },
        });
      });
    },
    { scope }
  );

  return scope;
}

/* --- parallax ------------------------------------------------------------- */

export function useParallax<T extends HTMLElement = HTMLElement>() {
  const scope = useRef<T>(null);

  useGSAP(
    () => {
      if (semMovimento()) return;
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((camada) => {
        gsap.to(camada, {
          yPercent: parseFloat(camada.dataset.parallax ?? "0") * 100,
          ease: "none",
          scrollTrigger: {
            trigger: scope.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    },
    { scope }
  );

  return scope;
}

/* --- contador ------------------------------------------------------------- */

export function useContador(
  ref: React.RefObject<HTMLElement | null>,
  ate: number
) {
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    if (semMovimento()) {
      el.textContent = ate.toLocaleString("pt-BR");
      return;
    }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: ate,
      duration: 1.8,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onUpdate() {
        el.textContent = Math.round(obj.v).toLocaleString("pt-BR");
      },
    });
  }, [ate]);
}
