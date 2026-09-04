/**
 * As colunas da planilha de leads, e de que campo do payload cada uma vem.
 *
 * Vive num ficheiro só porque é usado dos dois lados: pelo `planilha.cjs`, que
 * monta e conserta o cabeçalho a partir da máquina, e pelo `lead.cjs`, que
 * escreve as linhas no servidor. Duplicar isto seria garantir que um dia o
 * cabeçalho e as linhas deixam de bater certo.
 */

/** A equipa que lê esta planilha está em Maputo, não em UTC. O payload manda
 *  ISO com Z; aqui vira dia/mês/ano e hora local. Moçambique é +2 h e não tem
 *  horário de verão, então o deslocamento é fixo e dispensa tabela de fusos. */
function dataMaputo(iso) {
  const t = Date.parse(iso || "");
  const d = new Date(Number.isNaN(t) ? Date.now() + 2 * 3600 * 1000 : t + 2 * 3600 * 1000);
  const dd = (n) => String(n).padStart(2, "0");
  return `${dd(d.getUTCDate())}/${dd(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}`;
}

/**
 * A ordem é daqui, não das chaves do payload. Confiar na ordem de um JSON é
 * como o telemóvel ir parar debaixo de "E-mail" no dia em que alguém acrescenta
 * um campo antes.
 *
 * Coluna nova entra no FIM, nunca no meio. Inserir no meio desalinha as linhas
 * já gravadas: a "Chave" das antigas fica numa letra e a das novas noutra, e
 * ninguém repara até filtrar a coluna errada.
 */
const COLUNAS = [
  { titulo: "Recebido em", de: (d) => dataMaputo(d.enviadoEm), largura: 140 },
  { titulo: "Nome", de: (d) => d.nome, largura: 170 },
  { titulo: "E-mail", de: (d) => d.email, largura: 220 },
  { titulo: "Telemóvel", de: (d) => d.telefone, largura: 140 },
  { titulo: "WhatsApp", de: (d) => d.whatsapp, largura: 140 },
  { titulo: "Cidade", de: (d) => d.cidade, largura: 170 },
  { titulo: "País", de: (d) => d.pais, largura: 110 },
  { titulo: "Procedimento", de: (d) => d.procedimento, largura: 210 },
  { titulo: "Mensagem", de: (d) => d.mensagem, largura: 320 },
  { titulo: "Origem", de: (d) => d.origem, largura: 130 },
  { titulo: "Canal", de: (d) => d.channel, largura: 120 },
  { titulo: "utm_source", de: (d) => d.utm_source, largura: 120 },
  { titulo: "utm_medium", de: (d) => d.utm_medium, largura: 120 },
  { titulo: "utm_campaign", de: (d) => d.utm_campaign, largura: 170 },
  { titulo: "utm_term", de: (d) => d.utm_term, largura: 120 },
  { titulo: "utm_content", de: (d) => d.utm_content, largura: 150 },
  { titulo: "URL completa", de: (d) => d.urlCompleta, largura: 340 },
  { titulo: "Referrer", de: (d) => d.referrer, largura: 200 },
  { titulo: "Navegador", de: (d) => d.user_agent, largura: 220 },
  /**
   * Chave para ENXERGAR duplicado sem barrar. Quem carrega duas vezes no botão
   * gera duas linhas iguais; barrar arriscaria perder um lead legítimo, e
   * perder lead é pior que ver linha repetida. Com a chave, um filtro revela os
   * repetidos na hora.
   */
  {
    titulo: "Chave",
    de: (d) => [d.email, d.telefone].filter(Boolean).join("|"),
    largura: 260,
  },
];

/** O corpo que a página manda é um array de um item, por causa do Make. Aceita
 *  os dois formatos para o mesmo código servir nos dois caminhos. */
function linhaDe(bruto) {
  const d = Array.isArray(bruto) ? bruto[0] || {} : bruto || {};
  return COLUNAS.map((c) => {
    const v = c.de(d);
    return v === null || v === undefined ? "" : String(v);
  });
}

module.exports = { COLUNAS, linhaDe, dataMaputo };
