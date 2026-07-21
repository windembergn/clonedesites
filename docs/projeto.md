# O projeto

Dois "link-in-bio" clonados de templates Framer e reconstruídos em Next.js (App Router + TypeScript), cada um em sua própria subpasta.

## `dr-christian-ferreira/`

Clone de `drchristianferreira.framer.ai` (cirurgião plástico). Nome exibido: **"Christian Ferreira"**.

## `smart-plastica/`

Clone de `smartlover.framer.ai`, **rebrandeado para "Lumivie Clinique"**. A pasta manteve o nome antigo por inércia.

- Logo local em `public/logo-lumivi.jpeg`
- Frase: "O extraordinário começa em você"
- O card de baixo aponta para <http://lumivi.com.br/>

## Por que subpastas

A pasta raiz tem espaço e maiúsculas no nome, o que quebra o `create-next-app .`. Por isso cada app fica numa subpasta com nome válido para npm, e não há workspace/monorepo — os dois são projetos independentes com seu próprio `package.json` e `node_modules`.

## Tipografia e detalhes de layout

Ajustados a pedido, em `app/globals.css`:

| Seletor | Regra |
|---------|-------|
| `.name` | caixa normal (sem `text-transform`), `font-weight: 400` (sem negrito), `letter-spacing: -0.02em`, `font-size: 23px` |
| `.tagline` | `font-size: 17px` |

O **selo de verificado** é um SVG inline (componente `VerifiedBadge` em `app/page.tsx`) e usa o path do ícone "Verified" do Material Icons — selo azul `#3a86e0` com o check em branco. Uma versão anterior usava um path que cortava e deformava o selo; se o selo parecer estranho, é provavelmente isso.

## Imagens

No **Dr. Christian** os três cards já são locais, em `public/cards/card{1,2,3}.jpg`. A **foto de perfil** dele e as imagens do Lumivie continuam **hotlinkadas da CDN pública do Framer** (`framerusercontent.com`); para deixar offline, baixe para `public/` e ajuste os caminhos.

## Rastreamento

O `layout.tsx` do Dr. Christian carrega o **Meta Pixel** (`next/script`, `strategy="afterInteractive"`, com o `<img>` de fallback em `<noscript>`). O ID do pixel fica numa constante no topo do arquivo. O card "Agende sua consulta" aponta para um link rastreado do tintim.link, não direto para o WhatsApp.

Veja também [`shader-warp.md`](./shader-warp.md) para o fundo animado.
