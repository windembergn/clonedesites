"use client";

import { Warp } from "@paper-design/shaders-react";

type WarpBackgroundProps = {
  color1: string;
  color2: string;
  color3: string;
  speed?: number;
};

/**
 * Mesmo fundo animado do template original (shader "Warp" da biblioteca
 * open-source @paper-design/shaders 0.0.25, MIT), aqui com paleta própria.
 * Parâmetros de movimento idênticos aos extraídos do site original:
 *   scale 0.75 · proportion 0.63 · softness 1 · shape checks(0) · shapeScale 0.28
 *   distortion 0.1 · swirl 0.61 · swirlIterations 5 · rotation 0 · speed 0.3
 */
export default function WarpBackground({
  color1,
  color2,
  color3,
  speed = 0.3,
}: WarpBackgroundProps) {
  return (
    <Warp
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
      color1={color1}
      color2={color2}
      color3={color3}
      proportion={0.63}
      softness={1}
      shape={0}
      shapeScale={0.28}
      distortion={0.1}
      swirl={0.61}
      swirlIterations={5}
      scale={0.75}
      rotation={0}
      speed={speed}
    />
  );
}
