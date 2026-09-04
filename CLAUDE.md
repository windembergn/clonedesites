# Instruções do repositório

Quatro apps Next.js independentes, cada um na sua pasta. Trabalhe sempre dentro
da pasta do app, nunca na raiz (o nome da raiz tem espaço e quebra o npm).

| Pasta | O que é |
|-------|---------|
| `dr-christian-ferreira/` | Link-in-bio do Dr. Christian |
| `smart-plastica/` | Link-in-bio da Lumivie São Paulo (a pasta manteve o nome antigo) |
| `lumivie-pelotas/` | Link-in-bio da Lumivie Pelotas |
| `dr-christian-mocambique/` | Landing page de captação para pacientes moçambicanos |

> ⚠️ **Este repositório é público.** Nunca commitar IP, host, porta, caminho de
> servidor, chave SSH ou qualquer mapa da infraestrutura. Já houve uma invasão
> por porta exposta (ver `docs/seguranca.md`). Antes de qualquer push:
>
> ```bash
> git grep --cached -In -E "ssh-ed25519|BEGIN [A-Z ]*PRIVATE KEY|[0-9]{1,3}(\.[0-9]{1,3}){3}"
> ```
>
> Exit 1 significa limpo. Conferir o exit code: um `|| echo "limpo"` mascara erro
> de sintaxe como falso negativo.

## Duas coisas que quebram o projeto se alguém "melhorar"

1. **Não faça downgrade de Next ou React.** O piso é `next@15.5.20` +
   `react@19.2.7`, por causa do React2Shell (CVE-2025-55182, RCE de CVSS 10.0).
   Estes apps foram efetivamente invadidos por isso. Ver `docs/seguranca.md`.
2. **Não atualize `@paper-design/shaders-react` além da `0.0.25`.** A `0.0.77`
   reescreveu o shader `Warp` e não fica igual. Ver `docs/shader-warp.md`.

## Build

```bash
cd <pasta-do-app>
npm install
npm run dev
STATIC_EXPORT=1 npm run build          # gera out/
```

Servido sob um subcaminho (é o caso da LP de Moçambique):

```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/mocambique STATIC_EXPORT=1 npm run build
```

`MSYS_NO_PATHCONV=1` só no Git Bash do Windows: sem ele o `/mocambique` vira um
caminho do sistema e o build falha com `basePath has to start with a /`.

**Assets referenciados por CSS não recebem o basePath.** O Next não reescreve
`url()` dentro de CSS, então `url("/fonts/x.woff2")` dá 404 sob subcaminho. Ponha
o ficheiro dentro de `app/` e referencie relativo (`url("./fontes/x.woff2")`),
para o webpack montar o URL com o basePath e ainda pôr hash de cache.

## Escrita e copy

Regras que o cliente impôs e valem para todo texto visível:

- **Sem travessão.** Vírgula, ponto e dois pontos dão conta.
- **Sem a construção "não é X, é Y"** — lê-se como texto gerado.
- **Sem antecipação emocional** ("sem pressa e sem pressão nenhuma").
- No lugar disso: número, credencial, registo profissional, nome do hospital,
  fotografia do lugar real.

Comentários de código em português, explicando **por quê**, não o quê.

## Antes de dizer que está pronto

Compilar não é verificar. Rode a página e **meça**.

A LP de Moçambique traz dois testes que valem de modelo (`dr-christian-mocambique/`):

```bash
node pagina.cjs 1440 900 120 40   # largura altura passo espera(ms)
node fluidez.cjs                  # a tira horizontal da galeria presa
```

`pagina.cjs` percorre a página com a roda e exige **zero mudança de altura do
documento e zero recuo de scroll**. Essa é a regra que mais dói neste repo:
qualquer mudança de altura durante a rolagem faz o ScrollTrigger recalcular os
pins, e recalcular pin mexe no scroll — a página "teletransporta". Os dois
culpados até hoje foram imagem `loading="lazy"` em fluxo com `height: 100%` e um
cartão que crescia ao clicar.

Ao testar integrações de terceiros (Meta Pixel, webhooks, links de rastreio),
**intercepte o pedido no Playwright** em vez de disparar de verdade, e diga
depois que o teste não gerou registo real.
