"use client";

/* O mesmo arranjo do site da Lumivie: registar o kit uma vez para a app toda.
   Só entram os plugins que a página realmente usa, para o pacote não crescer
   à toa (a maior parte deste público navega em 3G/4G).

   O registo fica atrás de um teste de `window` porque estes plugins tocam no
   documento ao serem registados. No render do servidor isso rebenta com
   "a[d] is not a function" e a página inteira devolve 500. */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Observer } from "gsap/Observer";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, Observer, useGSAP);
}

export { gsap, ScrollTrigger, SplitText, Observer, useGSAP };
