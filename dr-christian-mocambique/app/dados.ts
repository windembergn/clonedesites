/* ---------------------------------------------------------------------------
   Conteúdo e constantes.

   A copy parte da página brasileira (drchristianferreira.com.br) e recebe só os
   ajustes que a VSL internacional pede: o Brasil apresentado antes do médico, a
   logística tratada de frente e o registo em português europeu, que é a norma
   de Moçambique.

   Origem dos números: CRM, RQE, sociedades, nº de cirurgias, anos de prática,
   morada e WhatsApp saem do site brasileiro. Etapas da jornada e tecnologias
   saem da transcrição da VSL (docs/vsl-exterior-transcricao.txt).
--------------------------------------------------------------------------- */

export const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const TELEFONE = "+55 11 95213-6738";
/* Link de rastreio (Tintim), e não o wa.me directo: é por ele que a clínica
   mede de onde vem cada conversa. Não aceita `?text=`, então o formulário
   deixou de tentar pré-escrever a mensagem e passou a registar o lead no
   webhook antes de encaminhar. */
export const WHATSAPP =
  "https://tintim.link/whatsapp/5880db1a-90a2-495e-9a51-27dc9c28bc7e/cc671ad8-afaf-4ab4-adc6-29404105cf41";
export const MORADA = "R. Canário, 539, Moema, São Paulo";
export const CRM = "CRM 194615 · RQE 140364";

export const img = (nome: string) => `${base}/img/${nome}.webp`;

export const NAV = [
  { href: "#video", texto: "Vídeo" },
  { href: "#medico", texto: "O médico" },
  { href: "#hospital", texto: "Hospital" },
  { href: "#jornada", texto: "Lumivie Day" },
  { href: "#procedimentos", texto: "Procedimentos" },
  { href: "#duvidas", texto: "Dúvidas" },
];

export const FAIXA_PROVA = [
  "Mais de 4.000 cirurgias realizadas",
  "10 anos de experiência",
  "Membro da SBCP e da BAPS",
  "Blanc Hospital, São Paulo",
  "Consulta online de duas horas",
  "Protocolo R24R",
];

export const NUMEROS = [
  { valor: 4000, prefixo: "+", rotulo: "cirurgias realizadas" },
  { valor: 10, prefixo: "+", rotulo: "anos de experiência" },
  { valor: 2, sufixo: " h", rotulo: "de consulta no Lumivie Day" },
  { valor: 24, sufixo: " h", rotulo: "de recuperação no protocolo R24R" },
];

export const PADRAO = [
  {
    n: "01",
    titulo: "Você recupera-se mais rápido",
    texto:
      "Protocolos próprios de recuperação acelerada, como a Prótese R24R e a Abdominoplastia de Recuperação Rápida, encurtam o tempo de afastamento da rotina. Para quem viajou de outro país, esse tempo conta duas vezes.",
    foto: "blanc-suite-presidencial",
  },
  {
    n: "02",
    titulo: "Planeamento feito para o seu corpo",
    texto:
      "Cada protocolo é desenvolvido individualmente, considerando a sua anatomia, o seu histórico e as suas expectativas. A escolha da técnica muda de paciente para paciente.",
    foto: "clinica-consultorio-3",
  },
  {
    n: "03",
    titulo: "Consulta online, cirurgia com segurança",
    texto:
      "Todo o pré e o pós-operatório podem ser conduzidos à distância. Você desloca-se apenas na véspera da cirurgia, e a equipa cuida da logística até ao regresso.",
    foto: "blanc-concierge",
  },
];

export const PROCEDIMENTOS = [
  {
    nome: "Abdominoplastia",
    foto: "proc-abdominoplastia",
    texto:
      "Remoção do excesso de pele e gordura abdominal para um contorno mais limpo e harmonioso, com o protocolo de recuperação rápida do Dr. Christian.",
  },
  {
    nome: "Prótese de Mama",
    foto: "proc-protese-mama",
    texto:
      "Aumento das mamas com prótese de silicone para mais proporção e equilíbrio, incluindo a técnica R24R, de recuperação em 24 horas.",
  },
  {
    nome: "Lipo HD",
    foto: "proc-lipo-hd",
    texto:
      "Lipoaspiração de alta definição, que esculpe o contorno corporal e evidencia a musculatura com naturalidade.",
  },
  {
    nome: "Mastopexia",
    foto: "proc-mastopexia",
    texto:
      "Levantamento e reposicionamento das mamas para recuperar firmeza e projecção.",
  },
  {
    nome: "Mommy Makeover",
    foto: "proc-mommy-makeover",
    texto:
      "Combinação personalizada de procedimentos para restaurar o contorno corporal depois da gestação.",
  },
  {
    nome: "Mamoplastia Redutora",
    foto: "proc-mamoplastia-redutora",
    texto:
      "Redução das mamas para aliviar desconfortos físicos e trazer mais equilíbrio ao corpo.",
  },
  {
    nome: "Lipoaspiração",
    foto: "proc-lipoaspiracao",
    texto:
      "Remoção de gordura localizada com ultrassom para emulsificar antes de aspirar, o que permite tratar áreas maiores com menos trauma.",
  },
  {
    nome: "Cirurgias Combinadas",
    foto: "proc-combinadas",
    texto:
      "Mais de um procedimento no mesmo tempo cirúrgico, planeado para resolver mais numa só viagem.",
  },
];

export const NOMES_PROCEDIMENTOS = PROCEDIMENTOS.map((p) => p.nome);

export const JORNADA = [
  {
    n: "01",
    titulo: "O primeiro contacto",
    texto:
      "Você fala com a consultora pelo WhatsApp e conta o que procura. Ela explica como funciona o atendimento internacional e agenda o Lumivie Day.",
  },
  {
    n: "02",
    titulo: "Lumivie Day, a consulta com o Dr. Christian",
    texto:
      "Uma videochamada de hora e meia a duas horas, directamente com ele. Tempo para ouvir os seus objectivos, avaliar a sua anatomia e construir o planeamento cirúrgico.",
  },
  {
    n: "03",
    titulo: "O plano e o investimento por escrito",
    texto:
      "Você recebe o planeamento feito para o seu corpo, o tempo de recuperação previsto e o valor, antes de comprar qualquer bilhete.",
  },
  {
    n: "04",
    titulo: "Exames a partir de Moçambique",
    texto:
      "A equipa indica os exames pré-operatórios que você faz aí mesmo, acompanha os resultados à distância e apoia na logística da viagem e da estadia.",
  },
  {
    n: "05",
    titulo: "A véspera, em Moema",
    texto:
      "Você chega a São Paulo e vem ao consultório para a avaliação presencial e as marcações. Esta é a única deslocação da jornada.",
  },
  {
    n: "06",
    titulo: "Cirurgia, internamento e regresso",
    texto:
      "A cirurgia acontece no Blanc Hospital. Depois vêm os dias de recuperação acompanhados de perto e, com a alta para voar, o pós-operatório continua por vídeo.",
  },
];

/* Nove peças, e não as treze que existem: cada uma custa quase uma tela de
   rolagem enquanto a seção está presa, e a tira ficava mais longa que o
   argumento que ela sustenta. */
export const GALERIA_HOSPITAL = [
  { src: "blanc-fachada", legenda: "Fachada, São Paulo", alt: "Fachada envidraçada do Blanc Hospital em São Paulo" },
  { src: "blanc-recepcao", legenda: "Recepção", alt: "Recepção do Blanc Hospital" },
  { src: "blanc-centro-cirurgico", legenda: "Centro cirúrgico", alt: "Corredor do centro cirúrgico" },
  { src: "blanc-sala-cirurgica", legenda: "Sala cirúrgica", alt: "Sala cirúrgica equipada" },
  { src: "blanc-uti", legenda: "Cuidados intensivos", alt: "Unidade de cuidados intensivos" },
  { src: "blanc-suite-presidencial", legenda: "Suíte presidencial", alt: "Suíte presidencial de internamento" },
  { src: "blanc-bistro", legenda: "Bistrô e lounge VIP", alt: "Bistrô sob cúpula de vidro" },
  { src: "blanc-mordomo", legenda: "Serviço de mordomo", alt: "Mordomo servindo prato coberto" },
  { src: "blanc-equipe", legenda: "Equipa assistencial", alt: "Equipa assistencial do hospital" },
];

export const GALERIA_CLINICA = [
  { src: "clinica-fachada", legenda: "Entrada, Moema", alt: "Fachada do consultório em Moema" },
  { src: "clinica-recepcao", legenda: "Recepção", alt: "Recepção do consultório" },
  { src: "clinica-espera", legenda: "Sala de espera", alt: "Sala de espera com poltronas e jardim" },
  { src: "clinica-lounge", legenda: "Lounge", alt: "Lounge de espera do consultório" },
  { src: "clinica-consultorio", legenda: "Consultório", alt: "Consultório de atendimento" },
  { src: "clinica-sala", legenda: "Sala de procedimentos", alt: "Sala de procedimentos" },
  { src: "clinica-manifesto", legenda: "O extraordinário começa em você", alt: "Parede com a frase O extraordinário começa em você" },
];

/* Os retratos saem dos depoimentos em vídeo do site brasileiro, que lá aparecem
   sem nome. Os depoimentos escritos, esses, têm nome mas não têm rosto. Ficam
   separados de propósito: pôr o nome de uma paciente debaixo do rosto de outra
   seria inventar. Assim que houver o vídeo (ou o nome de quem fala nele), dá
   para juntar. */
/* Os nomes vêm do título de cada vídeo no canal do Dr. Christian
   ("Depoimento_Alessandra"). O primeiro está publicado como
   "Depoimento_Moçambique", sem nome da paciente, então o cartão diz só de onde
   ela vem: melhor isso do que um nome inventado. */
export const VIDEOS_DEPOIMENTO = [
  {
    foto: "depoimento-mocambique",
    id: "JwDyXeGkYm8",
    nome: "Moçambique",
    alt: "Paciente moçambicana do Dr. Christian no seu depoimento em vídeo",
  },
  {
    foto: "depoimento-1",
    id: "dh2l6l53GLE",
    nome: "Alessandra",
    alt: "Alessandra, paciente do Dr. Christian, no seu depoimento em vídeo",
  },
  {
    foto: "depoimento-3",
    id: "lI1h9zL3WDA",
    nome: "Glaucia",
    alt: "Glaucia, paciente do Dr. Christian, no seu depoimento em vídeo",
  },
];

export const DEPOIMENTOS = [
  {
    texto:
      "Desde a primeira videochamada senti-me acolhida. A consultora explicou tudo com clareza e orientou-me em cada etapa. Hoje olho ao espelho e reconheço-me.",
    nome: "Paola Vieira",
    proc: "Abdominoplastia",
  },
  {
    texto:
      "Realizei um sonho que parecia impossível. O pagamento facilitado e o acompanhamento próximo fizeram toda a diferença. Valeu cada segundo.",
    nome: "Rafaela Becker",
    proc: "Aumento de Mama",
  },
];

export const DUVIDAS = [
  {
    p: "O que é o Lumivie Day?",
    r: "É o dia da sua primeira consulta com o Dr. Christian, uma videochamada de hora e meia a duas horas dedicada ao seu caso. Ele ouve os seus objectivos, avalia a sua anatomia e cria um plano de tratamento individualizado, do pré ao pós-operatório.",
  },
  {
    p: "Quantas vezes preciso de vir ao Brasil?",
    r: "Uma. Toda a preparação e todo o acompanhamento pós-operatório podem ser feitos por vídeo, a partir de Moçambique. Você chega na véspera da cirurgia.",
  },
  {
    p: "Quanto tempo tenho de ficar em São Paulo?",
    r: "Depende do procedimento e da sua recuperação, e fica definido no Lumivie Day, antes de marcar viagem. A alta para voar é uma decisão médica, avaliada caso a caso.",
  },
  {
    p: "Posso vir acompanhada?",
    r: "Pode, e é recomendado. O Blanc Hospital tem estrutura para acompanhantes, e o consultório fica em Moema, com hotelaria e restaurantes a poucos minutos a pé.",
  },
  {
    p: "Em que língua decorre a consulta?",
    r: "Em português, com o Dr. Christian e com toda a equipa, do primeiro contacto ao último retorno.",
  },
  {
    p: "Como funciona o pagamento vindo do estrangeiro?",
    r: "A consultora apresenta as formas de pagamento disponíveis para pacientes internacionais e o que fica incluído: honorários, hospital, materiais e retornos. O Lumivie Day é agendado antes de qualquer compromisso financeiro com a cirurgia.",
  },
  {
    p: "Qual é o valor da cirurgia?",
    r: "Cada paciente tem uma anatomia, um objectivo e um risco diferentes, por isso o investimento é definido depois da avaliação individual. Você recebe o orçamento por escrito, junto com o planeamento cirúrgico.",
  },
  {
    p: "O que é a técnica R24R de prótese de mama?",
    r: "Um protocolo exclusivo desenvolvido pelo Dr. Christian que permite recuperação em 24 horas após a cirurgia de aumento de mama. Combina técnica cirúrgica refinada, manejo anestésico avançado e um protocolo pós-operatório estruturado.",
  },
];
