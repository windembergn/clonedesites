# O fundo animado (shader Warp)

O fundo de "seda líquida" fluindo dos templates Framer é o shader **`Warp`** da biblioteca open-source **[`@paper-design/shaders`](https://github.com/paper-design/shaders)** (MIT).

## ⚠️ Não atualize a biblioteca

Os dois apps estão pinados em **`@paper-design/shaders-react@0.0.25`**, e isso é intencional.

A versão atual (`0.0.77`) **reescreveu o `Warp`**: mudou a API (passou a usar `twist`/`noise`/`colors[]`), escala o tempo de forma diferente e distribui as cores de forma diferente. O resultado **não fica igual** ao original. A `0.0.25` usa a API antiga, que é a que os sites Framer originais usam:

`color1` / `color2` / `color3` (hex) · `shape` (numérico) · `swirl` · `swirlIterations` · `distortion` · `shapeScale` · `proportion` · `softness`

## Parâmetros exatos

Extraídos dos uniforms do site original, lidos ao vivo via `gl.getUniform` no console do Chrome:

```
scale 0.75 · proportion 0.63 · softness 1 · shape 0 (checks) · shapeScale 0.28
distortion 0.1 · swirl 0.61 · swirlIterations 5 · rotation 0
```

**Velocidade:** o `u_time` do original avança ~**0,30/s**, então `speed={0.3}`.

> Medido acompanhando `u_time` por ~90 frames de `requestAnimationFrame`. Cuidado: a aba precisa estar **em foco**, senão o rAF pausa e a medição dá 0.

## Cores por app

O componente vive em `app/WarpBackground.tsx` de cada app, e as cores são passadas em `app/page.tsx`:

| App | color1 | color2 | color3 |
|-----|--------|--------|--------|
| **Lumivie** (idêntico ao original) | `#E0DACF` | `#914B2F` | `#5B2C1E` |
| **Dr. Christian** (dourado) | `#9a8160` | `#ddcebb` | `#927655` |

O fundo do Dr. Christian já passou por azul escuro, bronze fosco + travertino e azul petróleo antigo; a paleta atual é a dourada acima, escolhida no ajuste ao vivo (veja abaixo).

## Painel de ajuste ao vivo (`WarpTuner`)

No app do Dr. Christian o `page.tsx` não usa `WarpBackground` direto: usa `app/WarpTuner.tsx`, que o envolve e acrescenta um painel para mexer nas 3 cores em tempo real.

O painel **fica escondido por padrão** — só aparece com `?tune` na URL ou apertando `Shift+C`. O botão "Copiar hex" põe os 3 valores na área de transferência para colar de volta no `page.tsx`.

## Dica ao comparar com o original

Um print isolado pega **fases diferentes** da animação — ora uma região clara, ora uma dobra escura. Não confunda fase da animação com cor errada. Compare vários frames antes de concluir que a paleta está errada.
