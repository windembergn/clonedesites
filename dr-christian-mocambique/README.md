# Dr. Christian Ferreira — LP para Moçambique

Landing page de captação para pacientes moçambicanos que consideram operar em
São Paulo. Next.js 15 com exportação estática (o mesmo formato do site
`dr-christian-ferreira`, para servir por nginx sem processo Node).

O desenho e a gramática de animação seguem o site da Lumivie: GSAP com
ScrollTrigger, SplitText e Observer, scroll suave com Lenis, seções de altura de
tela, imagem sangrando até a borda e pouca coisa centralizada.

```bash
npm install
npm run dev                       # http://localhost:3000
STATIC_EXPORT=1 npm run build     # gera out/

# Servido sob um subcaminho (é assim que está publicado hoje):
MSYS_NO_PATHCONV=1 BASE_PATH=/mocambique STATIC_EXPORT=1 npm run build
```

`MSYS_NO_PATHCONV=1` só é preciso no Git Bash do Windows: sem ele o `/mocambique`
é convertido para um caminho do sistema e o build falha com
`basePath has to start with a /`.

O conteúdo de `out/` vai para uma pasta chamada `mocambique` na raiz do site de
links. As fontes vivem em `app/fontes/` (e não em `public/`) justamente para o
webpack montar os URLs com o basePath — ver a nota no topo de `globals.css`.

`shot.cjs` (Playwright) tira prints tela a tela, rolando como uma pessoa
rolaria: `node shot.cjs <pasta-de-saída> [desktop|mobile]`. Um print único de
página inteira não serve aqui, porque há seções que prendem na tela e o
`fullPage` do Playwright as captura fora de contexto.

## De onde veio a copy

A base é a copy da página brasileira (drchristianferreira.com.br), incluindo o
H1, o Dream Day, os três benefícios e os procedimentos. Por cima disso entram só
os ajustes que a VSL internacional pede (`docs/vsl-exterior-transcricao.txt`,
transcrita com faster-whisper `medium`):

- **O Brasil vem antes do médico.** É assim que a VSL abre, e faz sentido: quem
  está a 8.000 km precisa primeiro de acreditar no país. A seção de números
  carrega esse argumento com prova, não com adjectivo.
- **A logística ganha lugar próprio.** A jornada em seis passos e metade do FAQ
  respondem ao que realmente trava a decisão: quantas viagens, quanto tempo
  ficar, acompanhante, língua, pagamento do estrangeiro.
- **Português europeu**, que é a norma de Moçambique: *contacto*, *equipa*,
  *internamento*, *decorre*, *deslocação*. Trocar "equipe" por "equipa" parece
  detalhe, mas é o primeiro sinal de que a página foi escrita para eles.

### Regras de escrita adoptadas

- Sem travessão. Vírgula, ponto e dois pontos dão conta.
- Sem a construção "não é X, é Y", que envelheceu mal e soa a texto gerado.
- Sem tentar mexer no emocional por antecipação ("sem pressa e sem pressão").
  No lugar disso: número, credencial, registo profissional, nome do hospital,
  fotografia do sítio real.
- O CTA repete o termo da casa (Dream Day) em vez de inventar um novo.

## Marca

Tudo do *Brand Guidelines* (págs. 06 e 08):

| Cor | Hex | Uso na página |
| --- | --- | --- |
| Marfim calcário | `#f2eee6` | fundo dominante |
| Travertino | `#d8cdbb` | secções de respiro |
| Ónix | `#202223` | blocos escuros, texto |
| Petróleo antigo | `#213c3b` | tecnologia e contacto |
| Argila queimada | `#9b6651` | hover, barra de progresso |
| Bronze fosco | `#8a7658` | detalhes, cursor |

Tipografia: **Nostalgic Moment** (títulos), **CS Glodive** (texto e interface),
**Edwardian Script** (as duas frases assinadas). As três estão auto-hospedadas
em `public/fonts` — CS Glodive e Edwardian foram convertidas de OTF/TTF para
WOFF2. As três cobrem os acentos do português.

O `--bronze-texto` (`#6b5a41`) existe porque o bronze puro sobre marfim dá só
~3,4:1 de contraste, insuficiente para o texto miúdo e espaçado dos *eyebrows*.

## Animação

`app/lib/gsap.ts` regista o kit uma vez (ScrollTrigger, SplitText, Observer),
atrás de um teste de `window`: estes plugins tocam no documento ao registar e,
no render do servidor, derrubavam a página com um 500.

`app/hooks/anima.ts` traz os ganchos, no mesmo formato do site da Lumivie: um
`scope` na seção e filhos marcados por atributo.

| Marca | O que faz |
| --- | --- |
| `data-split` | título sobe linha a linha por trás de uma máscara |
| `data-reveal` | bloco sobe e aparece (o valor é o atraso em segundos) |
| `data-parallax="0.1"` | camada desliza com o scroll |

O que a página usa disso:

- **Hero**: retrato de estúdio ocupando toda a altura da coluna direita,
  entrada em cascata e parallax na saída.
- **Depoimentos** logo abaixo do hero: para quem chega desconfiado, ver outras
  pacientes vale mais no início do que no fim.
- **Faixa correndo**: acelera e inverte conforme a velocidade do scroll.
- **Galeria do hospital**: a seção prende na tela e o scroll vertical empurra a
  tira para o lado. Sem `anticipatePin`: ele antecipa o pin com base na
  velocidade do scroll, e o Lenis entrega uma velocidade suavizada, então a
  estimativa saía errada e a página saltava para a galeria e voltava. No telemóvel a fixação sai e volta a ser arrastar com o
  dedo, com o cartão de texto mais estreito que a tela para a primeira foto
  espreitar.
- **Consultório**: mosaico sangrado até a borda. Duas tiras horizontais
  seguidas cansariam, e aqui interessa ver o conjunto de uma vez.
- **Roleta de especialidades**: os nomes assentam num arco e giram com a roda
  do rato ou com o dedo. Cada procedimento traz a sua própria fotografia ao
  fundo (banco do site da Lumivie), porque foto de ambiente não diz nada sobre
  o procedimento em foco. Dá um empurrão sozinha na primeira vez que entra em
  tela, senão ninguém percebe que gira. Cada item que passa pelo ponteiro toca
  um tique (`app/lib/tique.ts`, portado da Lumivie): Web Audio em vez de
  `<audio>`, para o som sair no mesmo quadro da rotação, com os bytes buscados
  em tempo ocioso e o contexto destrancado no primeiro gesto real, já que roda
  de rato não conta como gesto para o browser.
- **Jornada**: a rota Maputo → São Paulo desenha-se em SVG conforme a lista
  avança. É o único desenho animado da página, e existe porque a jornada é
  exactamente o que este público precisa de visualizar. Mede exactamente a
  lista, da etapa 01 à 06, e fica quieta no lugar. Os marcos são HTML e não
  `<text>`, porque o desenho estica na vertical (`preserveAspectRatio="none"`)
  e esticaria a tipografia junto. O traço não usa `non-scaling-stroke`: com ele
  o tracejado é calculado no espaço já escalado enquanto `getTotalLength()`
  devolve unidades do viewBox, e o preenchimento aparecia deslocado.
- **Cursor próprio** e contadores nos números.

Duas coisas foram deliberadamente removidas depois de as ver a funcionar:

- **Botão magnético.** Os botões chegaram a puxar o cursor. Alvo que foge é
  alvo que se erra, ainda mais num formulário. Ficou só a cor a subir por baixo
  do rótulo no hover.
- **Empilhamento do FAQ com o CTA.** O FAQ ficava preso e o CTA subia por cima,
  como no fecho do site da Lumivie. Com uma resposta longa aberta, o fim do
  texto passava do fundo da janela e não havia como chegar lá: rolar só trazia
  o CTA. As duas seções voltaram a ser normais.
- **Esconder a barra do topo ao descer.** Nas seções presas o pin do
  ScrollTrigger corrige o scroll para compensar o espaçador, e cada correção
  era lida como mudança de direção: a barra piscava sem parar. Agora ela fica
  sempre visível e só troca de pele depois do hero.

Tudo desliga com `prefers-reduced-motion`, e o que depende de ponteiro fino sai
de cena no toque. A roleta tem um modo estático para esse caso, senão os nomes
ficariam empilhados na origem do arco.

## Média

- **Vídeo**: a VSL em duas versões — `vsl.mp4` (1280 px, 25 MB) e
  `vsl-960.mp4` (960 px, 12 MB). Carrega `preload="none"`, e o player escolhe a
  leve em ecrã pequeno ou quando o browser declara ligação lenta / poupança de
  dados.
- **Hospital**: fotografias da unidade **São Paulo** do Blanc, do CMS público do
  hospital. As de gastronomia no CMS são só de Salvador e Porto Alegre — por
  isso a página mostra o bistrô e o lounge VIP, que são de São Paulo.
- **Consultório**: banco de imagens do próprio consultório em Moema.
- **Retratos do Dr. Christian**: três fotografias de estúdio fornecidas pelo
  cliente. A do fato azul abre a página; a do blazer verde, que conversa com o
  petróleo da marca, fica na seção do médico.
- **Procedimentos**: banco de imagens do site da Lumivie, uma por procedimento.
- **Depoimentos em vídeo**: os três Shorts que o site brasileiro incorpora, com
  os mesmos cartazes. O `iframe` do YouTube só entra depois do clique: antes
  disso nenhum byte sai para lá, o que mantém a página leve e evita rasto de
  terceiros sem consentimento. A moldura é 9/16 desde o início e não muda de
  tamanho ao tocar: a versão anterior crescia no clique, e essa mudança de
  altura obrigava o ScrollTrigger a recalcular todos os pins da página.
  Os nomes saem do título de cada vídeo no YouTube.
- **Depoimentos escritos**: ficam numa fila própria, abaixo dos vídeos. Não são
  o mesmo cartão porque nada indica que sejam as mesmas pacientes: o site
  brasileiro publica os vídeos sem nome, e os textos sem rosto.

## O scroll saltava: a causa

A página deu saltos durante três rondas de revisão. A causa raiz era sempre a
mesma, e vale ficar registada porque volta a morder à primeira distração.

**Qualquer mudança na altura do documento durante a rolagem faz o ScrollTrigger
recalcular todos os pins, e recalcular um pin significa mexer na posição do
scroll.** Daí o "teletransporte".

Duas coisas mudavam essa altura:

1. **Fotos que sangram numa coluna, em fluxo, com `height: 100%`.** Num pai de
   altura automática essa percentagem não resolve, e a imagem cai na altura
   natural. Como são `loading="lazy"`, isso só acontecia quando a imagem
   chegava: a seção do médico crescia 121 px a meio da rolagem. Hoje estas
   imagens são absolutas e não têm como mexer na altura de nada.
2. **O cartão de vídeo que crescia ao clicar** (moldura baixa que virava 9/16):
   434 px de diferença. Hoje nasce vertical e não muda.

Ficam dois testes no repositório para não voltar a acontecer sem se notar:

```bash
node pagina.cjs 1440 900 120 40   # largura altura passo espera(ms)
node fluidez.cjs                  # a tira horizontal da galeria presa
```

`pagina.cjs` percorre a página inteira com a roda e exige **zero mudanças de
altura do documento e zero recuos de scroll**. `fluidez.cjs` mede, na galeria
presa, quanto a tira anda por pixel de scroll: a razão tem de ser constante
(hoje é −1,000, com desvio só nas rampas de entrada e saída). Ambos apontam
para `http://127.0.0.1:3211`, então servir o build antes:

```bash
STATIC_EXPORT=1 npm run build
python -m http.server 3211 --bind 127.0.0.1 --directory out
```

Fechou limpo em 1440×900, 1536×864, 1920×1080, 1280×720 e 390×844.

## Estrutura de títulos e SEO

O `SplitText` marca cada linha com `aria-hidden` e põe um `aria-label` no título.
O texto continua no DOM, mas ferramentas que montam o índice de headings (e
auditorias de SEO) mostravam **os títulos animados vazios**. Por isso o split
corre com `aria: "none"`: a linha volta a ser texto comum, e nada muda no
desenho nem na animação.

A hierarquia é a mesma da página brasileira (1 H1, vários H2, os procedimentos
como H3), e não tudo em H1. Vários H1 são válidos em HTML5 e o Google não
penaliza, mas também não dá ganho nenhum: o que faltava era **os títulos terem
texto legível**, e é isso que está resolvido. Conferido na página no ar: 38
títulos, zero vazios, os oito procedimentos entre eles.

## Meta Pixel

`1065431646110897`, declarado em `app/layout.tsx` com `next/script`
(`afterInteractive`) mais o `<noscript>`, no mesmo formato dos outros apps deste
repositório. É um pixel **próprio desta campanha**: não é o do link-in-bio dele
(`1728746434993942`) nem os das unidades da Lumivie.

Dispara só `PageView`. **Não há evento de conversão**: se a campanha precisar
otimizar por lead, falta um `fbq('track', 'Lead')` no envio do formulário, em
`app/secoes/fim.tsx`.

## Formulário e WhatsApp

- Todos os botões de WhatsApp usam o **link de rastreio da Tintim**. Ele não
  aceita `?text=`, então a mensagem deixou de ir pré-escrita.
- Quem leva o contexto agora é o envio de `app/lib/lead.ts`. O formulário
  regista o lead e só depois encaminha para o WhatsApp, na mesma ordem do
  formulário da Lumivie.
- O lead vai para **dois sítios, em paralelo**: `/api/lead`, que é nosso e
  escreve na planilha, e o **webhook do Make**, que é de outra pessoa e só
  recebe. Em paralelo e não em fila porque a paciente está a caminho do
  WhatsApp: somar os dois tempos atrasaria a navegação sem ganhar nada.
- O corpo vai como **array de um item**, e cada campo aparece em `snake_case` e
  em `camelCase`. As duas coisas são deliberadas: o Make infere a estrutura do
  webhook a partir da primeira amostra, e o cenário do cliente foi montado nesse
  formato (ver `server/src/lead-webhook.js` no projeto da Lumivie).
- O envio tem timeout de 4 s, usa `keepalive` e **nunca atira**. Um serviço de
  terceiro fora do ar não pode prender a paciente na página.
- **E-mail e telemóvel são obrigatórios.** O e-mail usa a validação nativa do
  `type="email"`; o telemóvel não tem validação nativa nenhuma, então
  `validarTelefone` em `app/secoes/fim.tsx` conta os algarismos e exige oito no
  mínimo (fixo de Maputo tem oito, telemóvel tem nove, com indicativo passa de
  doze).
- O número segue em três chaves: `telefone` e `phone` como a paciente escreveu,
  que é o que a equipa lê e liga, e `whatsapp` só com algarismos, que é o que um
  link `wa.me` aceita. Um número de nove algarismos começado por 8 leva o `258`
  à frente, porque é telemóvel moçambicano escrito sem indicativo; fora desse
  caso ninguém adivinha o país e vai como veio.

Para verificar: `node formulario.cjs [url] [ficheiro.json]` (com o `out/`
servido). Ele intercepta o Make, a Tintim e o pixel da Meta, então **não gera
lead nem registo real**. O segundo argumento guarda o corpo interceptado, que é
o que alimenta o `planilha.cjs` no teste de ponta a ponta.

## Planilha de leads

Planilha **Cristian Mocambique**, montada em 04/09/2026. As colunas e a origem
de cada uma vivem em `planilha.cjs`, que é a configuração como código: se a
planilha for apagada ou trocada, `node planilha.cjs cabecalho --aplicar`
reconstrói.

**O ID da planilha e a chave não estão no repositório**, que é público. Chegam
por argumento (`--planilha=`, `--chave=`) ou por variável de ambiente
(`PLANILHA_LEADS`, `GOOGLE_SA_JSON`).

Autentica com a conta de serviço `elevanto-sheets@elevanto.iam.gserviceaccount.com`,
a mesma que o Elevanto usa. **O acesso vem de partilhar o documento com esse
e-mail como Editor**, não de papel de IAM no projeto. Duas notas de quem já
tropeçou nisto:

- A **Drive API está desligada** no projeto Google `elevanto`. Só a Sheets API
  responde: dá para ler e escrever numa planilha cujo ID já se conhece, e não dá
  para listar, procurar nem partilhar.
- A gravação usa `valueInputOption=RAW`. Com `USER_ENTERED` uma mensagem
  começada por `=` viraria fórmula e um telemóvel perderia o `+`.

### Quem escreve na planilha

O **Make não escreve na planilha**. Ele só recebe, é de outra pessoa, e continua
a receber porque quem tem acesso a ele conta com isso.

Quem escreve é `servidor/lead.cjs`, na mesma forma da página da Sofer
(`api/leads.ts` na Vercel): o navegador posta num endereço do servidor e é o
servidor que fala com o Google. A razão de a peça existir é uma só, e vale a
pena não a esquecer: **uma página estática não pode guardar segredo nenhum**, e
a chave da conta de serviço tem de ficar do lado de lá.

A diferença para a Sofer é onde isto corre. Lá havia Vercel, com funções
prontas. Aqui a página é ficheiro estático atrás do nginx, então o mesmo papel é
feito por um processo próprio, alcançado só pelo nginx pela rede interna, **sem
porta publicada**. Já houve invasão nesta operação por porta exposta, e um
processo que segura credencial do Google não é sítio para repetir isso.

```
navegador ──┬─→ /api/lead ──→ servidor/lead.cjs ──→ Google Sheets
            └─→ webhook do Make (de outra pessoa, só recebe)
```

Três decisões dentro do `lead.cjs` que não se devem desfazer sem pensar:

- **Responde `200` antes de falar com o Google.** Quando isto corre, a paciente
  já carregou no botão. Um Google lento não pode virar erro na cara dela nem
  segurar a navegação. Se a gravação falhar, a falha e o payload inteiro vão
  para o log do contentor, que é onde alguém os pode recuperar.
- **Teto de 8 pedidos por minuto por IP**, em memória. Não é anti-abuso a
  sério, é para um script que descubra o endereço não encher a planilha da
  equipa em segundos.
- **`valueInputOption=RAW`.** Com `USER_ENTERED` uma mensagem começada por `=`
  viraria fórmula e um telemóvel perderia o `+` e os zeros à esquerda.

Só a **linha 1** é pintada; da 2 para baixo é fundo branco e texto preto. Isso é
aplicado de propósito, não é o padrão: o `append` do Sheets **herda o formato da
linha de cima**, então sem o reset o primeiro lead nascia com o fundo escuro do
cabeçalho, o segundo herdava do primeiro, e a planilha inteira ficava a parecer
cabeçalho. `node planilha.cjs cabecalho --reformatar --aplicar` reaplica cores e
larguras sem tocar nos títulos.

As colunas vivem em `servidor/colunas.cjs`, partilhadas entre o `planilha.cjs`
(que monta o cabeçalho) e o `lead.cjs` (que grava as linhas). Ter a lista num
lugar só é o que impede o cabeçalho e as linhas de deixarem de bater certo.

⚠️ Coluna nova entra sempre no **fim**. Inserir no meio desalinha as linhas já
gravadas, e ninguém repara até filtrar a coluna errada.

O `docker-compose.yml`, o `.env` e a rota do nginx ficam **fora deste
repositório**, que é público.

## Notas de desempenho

Três coisas foram trocadas depois de o cliente relatar scroll aos solavancos:

- **`backdrop-filter` na barra do topo e na barra do telemóvel.** O desfoque
  recompõe a faixa inteira a cada quadro por cima de conteúdo em movimento. As
  duas passaram a cor cheia, com o mesmo aspecto.
- **Grão de filme nas seções que animam a tela toda** (galeria presa e roleta).
  `mix-blend-mode` num elemento do tamanho da janela força recomposição
  constante. Ficou só no hero e no vídeo, que são estáticos.
- **Refresh do ScrollTrigger.** Um `ScrollTrigger.refresh()` explícito quando
  `document.fonts.ready` resolve. As fontes de título trocam as métricas do
  texto quando chegam, o que muda a altura do documento; sem o refresh
  controlado, o reajuste caía a meio da rolagem e mexia na posição do scroll.

## A confirmar com o cliente antes de publicar

1. **Morada do consultório.** Usei `R. Canário, 539 — Moema`, do site brasileiro.
   O FAQ do site tem outra morada ("R. Canadá, 301 – América"), que parece
   resíduo. Confirmar qual vale.
2. **WhatsApp.** `+55 11 95213-6738` (o do site). O rodapé do site brasileiro
   mostra ainda `(11) 91753-4846` — confirmar qual atende o internacional.
3. **Horário de atendimento.** O site brasileiro diz "segunda a sexta, das 9h às
   19h". Maputo está 5 horas à frente de Brasília, então a página escreve o
   mesmo horário já convertido: "das 14h às 24h de Maputo". Confirmar que a
   central atende nessa faixa.
4. **Depoimentos.** São de pacientes brasileiras. Se houver depoimento de
   paciente internacional, substitui com muito mais força.
5. **O vídeo do meio.** Os outros dois estão no canal "Igor Ferraz" com título
   "Depoimento Alessandra" e "Depoimento Glaucia", e é daí que vêm os nomes na
   página. O do meio está publicado no canal **Smart Plástica** com o título
   "30 de outubro de 2025": fica sem nome, e vale confirmar se deve mesmo estar
   nesta página, já que é outra marca a hospedá-lo.
6. **Pixel e analytics.** A página não tem nenhum, por opção. Dizer qual entra
   quando for a hora.
