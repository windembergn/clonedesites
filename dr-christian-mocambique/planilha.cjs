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

/* As colunas vivem no `servidor/colunas.cjs`, partilhadas com o processo que
   grava os leads. Ter a lista num lugar só é o que impede o cabeçalho e as
   linhas de deixarem de bater certo. */
const { COLUNAS, linhaDe } = require("./servidor/colunas.cjs");

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
  const valores = linhaDe(bruto);
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
