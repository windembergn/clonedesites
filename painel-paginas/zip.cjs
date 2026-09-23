/**
 * Leitor de .zip sem dependências: o suficiente para abrir o zip de um site
 * exportado (Webflow, Framer, um tema, uma pasta comprimida no Windows ou Mac).
 *
 * Lê o diretório central no fim do arquivo e descomprime cada entrada com o
 * zlib do próprio Node. Suporta os dois métodos que se encontram na prática,
 * guardado (0) e deflate (8). Zip cifrado e ZIP64 são recusados com mensagem.
 *
 * Um zip vem de fora, então nada nele é confiado:
 *   - o tamanho descomprimido declarado soma-se ANTES de descomprimir, e cada
 *     entrada é descomprimida com teto nesse tamanho (zip bomb pára aí);
 *   - nomes passam por `caminhoSeguro`, que recusa `..`, caminho absoluto e
 *     caracteres que o Windows ou o nginx tratariam de outro jeito;
 *   - entradas que são link simbólico são ignoradas, para ninguém criar um
 *     atalho que aponte para fora da pasta do site.
 */
const zlib = require("zlib");

const LIXO = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i;

/** Normaliza um caminho relativo vindo de fora, ou lança erro com o motivo. */
function caminhoSeguro(bruto, { permitirVazio = false } = {}) {
  const partes = String(bruto || "").replace(/\\/g, "/").split("/").filter((p) => p !== "");
  if (!partes.length) {
    if (permitirVazio) return "";
    throw Object.assign(new Error("Caminho vazio."), { status: 400 });
  }
  if (partes.length > 20) throw Object.assign(new Error("Pastas demais umas dentro das outras."), { status: 400 });
  for (const p of partes) {
    if (p === "." || p === "..") throw Object.assign(new Error(`Caminho inválido: "${bruto}".`), { status: 400 });
    // Arquivo oculto (.htaccess, .env) não tem uso num site estático e poderia
    // esconder coisa que ninguém vê na lista.
    if (p.startsWith(".")) throw Object.assign(new Error(`Nome que começa com ponto não é aceito: "${p}".`), { status: 400 });
    if (p.length > 120) throw Object.assign(new Error(`Nome longo demais: "${p.slice(0, 30)}...".`), { status: 400 });
    if (/[\u0000-\u001f<>:"|?*]/.test(p)) throw Object.assign(new Error(`Nome com caractere não aceito: "${p}".`), { status: 400 });
  }
  return partes.join("/");
}

/**
 * Devolve [{ nome, dados }] só com arquivos (pastas saem dos caminhos).
 * Limites: `maxArquivos` entradas e `maxBytes` descomprimidos no total.
 */
function lerZip(buf, { maxArquivos = 5000, maxBytes = 300 * 1024 * 1024 } = {}) {
  const erro = (m) => Object.assign(new Error(m), { status: 400 });

  // O fim do diretório central fica nos últimos 22 bytes, mais um comentário
  // opcional de até 64 KB.
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw erro("Isso não parece um arquivo .zip.");
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  if (total === 0xffff || p === 0xffffffff) throw erro("Zip no formato ZIP64 não é aceito. Comprima de novo com menos de 4 GB.");
  if (total > maxArquivos) throw erro(`O zip tem ${total} arquivos; o máximo é ${maxArquivos}.`);

  const entradas = [];
  let soma = 0;
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw erro("Zip corrompido.");
    const flags = buf.readUInt16LE(p + 8);
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const tamanho = buf.readUInt32LE(p + 24);
    const lenNome = buf.readUInt16LE(p + 28);
    const lenExtra = buf.readUInt16LE(p + 30);
    const lenComent = buf.readUInt16LE(p + 32);
    const atributos = buf.readUInt32LE(p + 38);
    const local = buf.readUInt32LE(p + 42);
    // Bit 11 = nome em UTF-8. Sem ele, o padrão é CP437; nomes com acento de
    // zips antigos do Windows podem vir trocados, mas o arquivo não se perde.
    const nome = buf.toString(flags & 0x800 ? "utf8" : "latin1", p + 46, p + 46 + lenNome);
    p += 46 + lenNome + lenExtra + lenComent;

    if (nome.endsWith("/") || LIXO.test(nome)) continue;
    if (((atributos >>> 16) & 0o170000) === 0o120000) continue; // link simbólico
    if (flags & 0x1) throw erro("Zip com senha não é aceito.");
    if (metodo !== 0 && metodo !== 8) throw erro(`"${nome}" usa um tipo de compressão não suportado. Comprima de novo pelo sistema.`);
    soma += tamanho;
    if (soma > maxBytes) throw erro(`O zip descomprimido passa de ${Math.round(maxBytes / 1048576)} MB.`);
    entradas.push({ nome, metodo, comprimido, tamanho, local });
  }

  return entradas.map((e) => {
    if (buf.readUInt32LE(e.local) !== 0x04034b50) throw erro("Zip corrompido.");
    const inicio = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const bruto = buf.subarray(inicio, inicio + e.comprimido);
    const dados = e.metodo === 0 ? Buffer.from(bruto) : zlib.inflateRawSync(bruto, { maxOutputLength: Math.max(e.tamanho, 1) });
    if (dados.length !== e.tamanho) throw erro(`"${e.nome}" veio com tamanho diferente do declarado.`);
    return { nome: caminhoSeguro(e.nome), dados };
  });
}

/**
 * Se tudo estiver dentro de uma única pasta (o caso de "comprimir pasta"),
 * tira essa pasta do caminho: o index.html fica na raiz do site.
 */
function tirarPastaUnica(arquivos) {
  if (!arquivos.length) return arquivos;
  const primeira = arquivos[0].nome.split("/")[0];
  const todos = arquivos.every((a) => a.nome.includes("/") && a.nome.split("/")[0] === primeira);
  return todos ? arquivos.map((a) => ({ ...a, nome: a.nome.slice(primeira.length + 1) })) : arquivos;
}

module.exports = { lerZip, tirarPastaUnica, caminhoSeguro };
