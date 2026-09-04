"use client";

import "./secoes.css";
import { useScrollSuave } from "./hooks/anima";
import { Cursor, Progresso } from "./components/base";
import { FaixaProva, Hero, Navbar, Prova, Video } from "./secoes/topo";
import {
  Clinica,
  Hospital,
  Jornada,
  Medico,
  Moema,
  Padrao,
} from "./secoes/meio";
import { Barra, Depoimentos, Fecho, Rodape, Roleta } from "./secoes/fim";

/* ---------------------------------------------------------------------------
   Ordem das seções.

   A copy é a da página brasileira, com o ajuste que a VSL internacional pede:
   antes de falar do médico, a página estabelece por que São Paulo (o argumento
   que abre o vídeo), e a logística de quem vem de fora ganha lugar próprio na
   jornada e nas dúvidas.
--------------------------------------------------------------------------- */

export default function Pagina() {
  useScrollSuave();

  return (
    <>
      <Progresso />
      <Cursor />
      <Navbar />
      <Barra />

      <main>
        <Hero />
        <FaixaProva />
        {/* Os depoimentos sobem para logo abaixo do hero: para quem chega
            desconfiado, ver outras pacientes a falar vale mais no início do que
            no fim. */}
        <Depoimentos />
        <Prova />
        <Video />
        <Medico />
        <Padrao />
        <Hospital />
        <Moema />
        <Jornada />
        <Clinica />
        <Roleta />
        <Fecho />
      </main>

      <Rodape />
    </>
  );
}
