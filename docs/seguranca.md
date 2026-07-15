# Segurança: o incidente do React2Shell

> **Resumo:** estes apps rodavam `next@15.1.6` + `react@19.0.0` e **foram invadidos**. Não faça downgrade das versões atuais.

## O que aconteceu

Em **15/07/2026**, os dois apps foram comprometidos por um RCE não-autenticado nos React Server Components, apelidado **React2Shell**:

- **[CVE-2025-55182](https://www.cve.org/CVERecord?id=CVE-2025-55182)** — upstream, no React (CVSS **10.0**)
- **[CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478)** — impacto downstream no Next.js (App Router)

O ponto que importa: **a configuração padrão do `create-next-app` já é vulnerável**, sem nenhum erro de código do desenvolvedor. Basta uma requisição HTTP forjada contra qualquer endpoint do App Router. Como os apps estavam com as portas publicadas direto no IP público, scanners automatizados os acharam sozinhos.

O atacante instalou um minerador de Monero (XMRig) que consumia ~180% de CPU, e hookou o servidor para sequestrar as respostas HTTP e redirecionar (307) os visitantes para um site de terceiros. Ou seja: o site não saiu do ar — ele passou a servir conteúdo do atacante, o que é bem pior, porque parece que está funcionando.

## Versões seguras

Hoje: **`next@15.5.20`** + **`react`/`react-dom@19.2.7`**.

A correção veio em **três ondas**, e é fácil errar aqui:

| Versão | Situação |
|--------|----------|
| `15.1.6` | Vulnerável ao RCE. Era a versão original destes apps. |
| `15.1.9` | Corrige **só** o RCE. **Ainda marcada como deprecated pelo npm** — CVE-2025-55183 (exposição de código-fonte) e CVE-2025-55184 + CVE-2025-67779 (DoS). |
| `15.1.11` / `15.1.12` | Primeiras versões limpas da linha 15.1.x. |
| `15.5.20` | **Atual.** A linha 15.1 não recebe os fixes acumulados (cache poisoning, SSRF, XSS), por isso migramos. |

**Dica prática:** o npm marca as versões vulneráveis do Next como `deprecated`, então dá para checar direto:

```bash
npm view next@15.1.9 deprecated
```

Se retornar texto, a versão tem vulnerabilidade conhecida. Se retornar vazio, está limpa. (Isso **não** funciona para o `react` — a Meta não marca as versões como deprecated.)

Para checar/corrigir automaticamente, a Vercel publicou uma ferramenta:

```bash
npx fix-react2shell-next
```

## Falso positivo do `npm audit`

O `npm audit` acusa 2 vulnerabilidades moderadas de `postcss`. Pode ignorar: é dependência transitiva do Next, afeta só build-time (XSS exigindo CSS controlado pelo atacante), e o `npm audit fix --force` "resolve" fazendo **downgrade para `next@9.3.3`** — o que seria muito pior.

## Hardening aplicado

- Dockerfile roda como usuário `nextjs` (uid 1001), **não root** — o minerador tinha root porque o container rodava como root
- Containers com `--cap-drop ALL`, `--security-opt no-new-privileges`, `--read-only` + `--tmpfs /tmp`
- Ver [`deploy.md`](./deploy.md)

## Lições

1. **Trave e acompanhe as versões do Next/React.** Esta falha não exigia código inseguro — só uma versão desatualizada.
2. **Não publique a porta do app direto na internet.** Use reverse proxy com domínio e TLS.
3. **Não rode container como root.**
4. **Um site que "funciona" pode estar comprometido.** Aqui, o sintoma visível foi um redirect estranho — o resto estava invisível.
