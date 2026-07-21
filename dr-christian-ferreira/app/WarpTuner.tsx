"use client";

import { useEffect, useState } from "react";
import WarpBackground from "./WarpBackground";

type WarpTunerProps = {
  c1: string;
  c2: string;
  c3: string;
  speed?: number;
};

/**
 * Envolve o fundo animado e — quando a URL tem `?tune` (ou você aperta
 * Shift+C) — mostra um painel para ajustar as 3 cores do shader em tempo
 * real. É só uma ferramenta de teste: o visitante normal nunca vê o painel.
 * O botão "Copiar" põe os 3 hex na área de transferência para você me mandar
 * ou colar no código.
 */
export default function WarpTuner({ c1, c2, c3, speed = 0.3 }: WarpTunerProps) {
  const [color1, setColor1] = useState(c1);
  const [color2, setColor2] = useState(c2);
  const [color3, setColor3] = useState(c3);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("tune")) setOpen(true);

    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "c") setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copy = async () => {
    const text = `color1="${color1}"\ncolor2="${color2}"\ncolor3="${color3}"`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado — ignora */
    }
  };

  const rows: [string, string, (v: string) => void][] = [
    ["Mais clara", color1, setColor1],
    ["Meio", color2, setColor2],
    ["Mais escura", color3, setColor3],
  ];

  return (
    <>
      <WarpBackground
        color1={color1}
        color2={color2}
        color3={color3}
        speed={speed}
      />

      {open && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 9999,
            width: 220,
            padding: "14px 14px 12px",
            borderRadius: 12,
            background: "rgba(8, 16, 20, 0.82)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            color: "#eef4f4",
            fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Ajuste de cor</span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#9fb4b4",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          {rows.map(([label, value, set]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="color"
                value={value}
                onChange={(e) => set(e.target.value)}
                style={{
                  width: 34,
                  height: 28,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ opacity: 0.7 }}>{label}</div>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    color: "#eef4f4",
                    padding: "2px 6px",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>
          ))}

          <button
            onClick={copy}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "7px 0",
              borderRadius: 8,
              border: "none",
              background: copied ? "#2c6e6b" : "#0a5a56",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? "Copiado!" : "Copiar hex"}
          </button>
        </div>
      )}
    </>
  );
}
