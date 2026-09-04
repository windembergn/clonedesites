/**
 * A planilha de leads da LP de Moçambique, como código.
 *
 * Serve para duas coisas: montar (ou consertar) o cabeçalho, e escrever uma
 * linha a partir do mesmo corpo que a página manda para o webhook. Existe no
 * repositório porque é aqui, num lugar só, que fica dito quais colunas a
 * planilha tem e de que campo do payload cada uma vem. Se a planilha for
 * apagada sem querer, ou trocada, isto reconstrói.
 *
 * Este repositório é PÚBLICO. Nem a chave nem o ID da planilha vivem aqui: os
 * dois chegam por argumento ou variável de ambiente e o script só repassa.
 *
 *   node planilha.cjs ver        --chave=<caminho.json> --planilha=<id>
 *   node planilha.cjs cabecalho  --chave=... --planilha=... --aplicar
 *   node planilha.cjs linha      --chave=... --planilha=... --corpo=<lead.json> --aplicar
 *
 * Sem `--aplicar` nada é gravado: imprime o que faria.
 *
 * A autenticação é a conta de serviço do Google. O acesso vem de partilhar o
 * documento com o e-mail dela como Editor, não de papel de IAM no projeto, que
 * é a confusão comum. O JWT é assinado com o `crypto` do próprio node para não
 * arrastar a `googleapis` para um app que não precisa dela em runtime.
 */
const crypto = require("crypto");
const fs = require("fs");

const arg = (n) =>
  (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=");
const COMANDO = process.argv[2];
const APLICAR = process.argv.includes("--aplicar");
const CHAVE = arg("chave") || process.env.GOOGLE_SA_JSON;
const PLANILHA = arg("planilha") || process.env.PLANILHA_LEADS;
const ABA = arg("aba") || "Página1";

/**
 * As colunas, em ORDEM, e de onde cada uma vem.
 *
 * A ordem é daqui, não das chaves do payload. Confiar na ordem de um JSON é
 * como o telemóvel ir parar debaixo de "E-mail" no dia em que alguém acrescenta
 * um campo antes.
 *
 * Coluna nova entra no FIM, nunca no meio. Inserir no meio desalinha as linhas
 * já gravadas: a "Chave" das antigas fica numa letra e a das novas noutra, e
 * ninguém repara até filtrar a coluna errada.
 *
 * Os primeiros campos são o lead; do "Origem" para baixo é rastreio. A "URL
 * completa" é a única que traz os parâmetros da query tal como a paciente
 * chegou (`?utm_source=...&fbclid=...`), então é ela que responde de que
 * anúncio exatamente veio esta pessoa quando as colunas utm_* não bastam.
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

/** A equipa que lê esta planilha está em Maputo, não em UTC. O payload manda
 *  ISO com Z; aqui vira dia/mês/ano e hora local. Moçambique é +2 h e não tem
 *  horário de verão, então o deslocamento é fixo e dispensa tabela de fusos. */
function dataMaputo(iso) {
  const t = Date.parse(iso || "");
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 2 * 3600 * 1000);
  const dd = (n) => String(n).padStart(2, "0");
  return `${dd(d.getUTCDate())}/${dd(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}`;
}

const b64 = (o) =>
  Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

async function token() {
  const sa = JSON.parse(fs.readFileSync(CHAVE, "utf8"));
  const agora = Math.floor(Date.now() / 1000);
  const base = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: agora + 3600,
    iat: agora,
  })}`;
  const assinatura = crypto
    .createSign("RSA-SHA256")
    .update(base)
    .sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${base}.${assinatura}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`autenticação recusada: ${JSON.stringify(j)}`);
  return { token: j.access_token, conta: sa.client_email };
}

async function sheets(t, caminho, metodo = "GET", corpo) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${PLANILHA}${caminho}`,
    {
      method: metodo,
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 500)}`);
  return j;
}

/** Devolve o `sheetId` numérico da aba. As chamadas de formatação usam esse
 *  número, não o nome, e uma aba renomeada mantém o mesmo id. */
async function idDaAba(t) {
  const m = await sheets(t, "?fields=properties.title,sheets.properties(sheetId,title)");
  const aba = m.sheets.find((s) => s.properties.title === ABA);
  if (!aba)
    throw new Error(
      `aba "${ABA}" não existe. Existem: ${m.sheets.map((s) => s.properties.title).join(", ")}`
    );
  return { id: aba.properties.sheetId, titulo: m.properties.title };
}

async function ver(t) {
  const { titulo } = await idDaAba(t);
  const v = await sheets(t, `/values/${encodeURIComponent(ABA)}`);
  const linhas = v.values || [];
  console.log(`planilha : ${titulo}`);
  console.log(`aba      : ${ABA}`);
  console.log(`cabeçalho: ${JSON.stringify(linhas[0] || [])}`);
  console.log(`leads    : ${Math.max(0, linhas.length - 1)}`);
  linhas.slice(1).forEach((l, i) => console.log(`  linha ${i + 2}: ${JSON.stringify(l.slice(0, 5))}`));
}

async function cabecalho(t) {
  const { id } = await idDaAba(t);
  const atual = (await sheets(t, `/values/${encodeURIComponent(ABA)}!1:1`)).values?.[0] || [];
  const querido = COLUNAS.map((c) => c.titulo);
  const igual =
    atual.length === querido.length && atual.every((v, i) => v === querido[i]);

  if (igual) return console.log("cabeçalho já está como devia, nada a fazer.");
  if (atual.length) {
    console.log("cabeçalho atual :", JSON.stringify(atual));
    console.log("ATENÇÃO: vai ser SUBSTITUÍDO. Confira se alguma coluna muda de");
    console.log("lugar antes de aplicar: linhas já gravadas não são movidas junto.");
  }
  console.log("cabeçalho novo  :", JSON.stringify(querido));
  if (!APLICAR) return console.log("\n(nada gravado: falta --aplicar)");

  await sheets(t, `/values/${encodeURIComponent(ABA)}!1:1?valueInputOption=RAW`, "PUT", {
    values: [querido],
  });
  await sheets(t, ":batchUpdate", "POST", {
    requests: [
      // Congelar a primeira linha: sem isto o cabeçalho some assim que a
      // planilha passar de uma tela de leads.
      {
        updateSheetProperties: {
          properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              // Petróleo e travertino, as duas cores da página.
              backgroundColor: { red: 0.109, green: 0.203, blue: 0.192 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 0.949, green: 0.933, blue: 0.902 },
              },
              horizontalAlignment: "LEFT",
            },
          },
          fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
        },
      },
      ...COLUNAS.map((c, i) => ({
        updateDimensionProperties: {
          range: { sheetId: id, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: c.largura },
          fields: "pixelSize",
        },
      })),
      // Mensagem e URL são os dois campos longos. Cortar em vez de quebrar:
      // uma linha alta por causa de um user agent esconde as vizinhas, e o
      // texto inteiro continua a aparecer ao clicar na célula.
      ...[8, 16, 18].map((i) => ({
        repeatCell: {
          range: { sheetId: id, startColumnIndex: i, endColumnIndex: i + 1, startRowIndex: 1 },
          cell: { userEnteredFormat: { wrapStrategy: "CLIP" } },
          fields: "userEnteredFormat.wrapStrategy",
        },
      })),
    ],
  });
  console.log("\ncabeçalho gravado, congelado e formatado.");
}

async function linha(t) {
  const bruto = JSON.parse(fs.readFileSync(arg("corpo"), "utf8"));
  // A página manda array de um item, porque é assim que o cenário do Make foi
  // montado. Aceita os dois formatos para o script servir nos dois caminhos.
  const d = Array.isArray(bruto) ? bruto[0] : bruto;
  const valores = COLUNAS.map((c) => {
    const v = c.de(d);
    return v === null || v === undefined ? "" : String(v);
  });
  COLUNAS.forEach((c, i) =>
    console.log(`  ${c.titulo.padEnd(14)} ${valores[i] || "(vazio)"}`)
  );
  if (!APLICAR) return console.log("\n(nada gravado: falta --aplicar)");

  // RAW e não USER_ENTERED: com USER_ENTERED uma mensagem começada por "=" ou
  // "+" vira fórmula, e um telemóvel perde o "+" e os zeros à esquerda.
  const r = await sheets(
    t,
    `/values/${encodeURIComponent(ABA)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: [valores] }
  );
  console.log(`\ngravado em ${r.updates.updatedRange}`);
}

(async () => {
  if (!CHAVE || !PLANILHA) {
    console.error(
      "faltam --chave=<caminho.json> e --planilha=<id> (ou GOOGLE_SA_JSON e PLANILHA_LEADS)"
    );
    process.exit(2);
  }
  const { token: t, conta } = await token();
  console.log(`conta de serviço: ${conta}\n`);
  if (COMANDO === "ver") await ver(t);
  else if (COMANDO === "cabecalho") await cabecalho(t);
  else if (COMANDO === "linha") await linha(t);
  else {
    console.error("comandos: ver | cabecalho | linha");
    process.exit(2);
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
