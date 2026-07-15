# Clones Framer → Next.js

Dois sites "link-in-bio" clonados a partir de templates Framer e reconstruídos em **Next.js (App Router + TypeScript)**, cada um com um **fundo animado de "seda líquida"** feito com shader WebGL.

| Pasta | Site | Clonado de | Paleta do fundo |
|-------|------|-----------|-----------------|
| [`dr-christian-ferreira/`](./dr-christian-ferreira) | Christian Ferreira (cirurgião plástico) | `drchristianferreira.framer.ai` | Bronze Fosco + Travertino (`#E4D5BE` / `#8B6F49` / `#46351F`) |
| [`smart-plastica/`](./smart-plastica) | **Lumivie Clinique** | `smartlover.framer.ai` | Original (`#E0DACF` / `#914B2F` / `#5B2C1E`) |

> A pasta `smart-plastica/` manteve o nome antigo, mas o site foi rebrandeado para **Lumivie Clinique**.
> A pasta raiz tem espaço e maiúsculas no nome, o que quebra o `create-next-app .` — por isso cada app vive em sua própria subpasta com nome válido para npm.

## Como rodar

Cada app é independente. Em qualquer uma das pastas:

```bash
cd dr-christian-ferreira   # ou smart-plastica
npm install
npm run dev
```

Abra <http://localhost:3000>.

Para gerar o build de produção:

```bash
npm run build
npm start
```

## ⚠️ Antes de mexer nas dependências

**Não faça downgrade do Next.js ou do React.** Estes apps rodam em `next@15.5.20` + `react@19.2.7`, e essas versões são um piso de segurança, não uma preferência.

Versões anteriores (incluindo a `15.1.6` original destes apps) são vulneráveis ao **React2Shell** — [CVE-2025-55182](https://www.cve.org/CVERecord?id=CVE-2025-55182) / [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478) —, um RCE não-autenticado de **CVSS 10.0** nos React Server Components. A configuração padrão do `create-next-app` já é vulnerável, sem nenhum erro de código do desenvolvedor: basta uma requisição HTTP forjada em qualquer endpoint do App Router. Estes apps **foram efetivamente invadidos e minerados** por essa falha. Detalhes e as versões mínimas seguras em [`docs/seguranca.md`](./docs/seguranca.md).

Se o `npm audit` reclamar de 2 vulnerabilidades moderadas do `postcss`, pode ignorar: é transitivo do Next, só afeta build-time, e o "fix" sugerido pelo npm é um downgrade para `next@9.3.3`.

## ⚠️ E não atualize o shader

A biblioteca do fundo animado está **pinada em `@paper-design/shaders-react@0.0.25` de propósito**. A versão atual (`0.0.77`) reescreveu o shader `Warp` e **não fica igual** ao original. Veja [`docs/shader-warp.md`](./docs/shader-warp.md) antes de encostar nisso.

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [`docs/projeto.md`](./docs/projeto.md) | O que é cada app, decisões de layout e tipografia |
| [`docs/shader-warp.md`](./docs/shader-warp.md) | O fundo animado: parâmetros exatos e por que a versão é pinada |
| [`docs/deploy.md`](./docs/deploy.md) | Como fazer deploy com Docker |
| [`docs/seguranca.md`](./docs/seguranca.md) | O incidente do React2Shell e as versões seguras |

## Imagens

As fotos de perfil e os cards são **hotlinkados da CDN pública do Framer** (`framerusercontent.com`), não versionados aqui. Se algum dia esses links caírem, ou para deixar o site 100% offline, baixe-os para `public/` e ajuste os caminhos em `app/page.tsx`. O logo da Lumivie é local (`smart-plastica/public/logo-lumivi.jpeg`).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · [`@paper-design/shaders-react`](https://github.com/paper-design/shaders) (MIT) · Docker (multi-stage, `output: "standalone"`)
