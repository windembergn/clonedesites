/**
 * Gera o PAINEL_SENHA_HASH do .env. Guarda-se só o hash: quem ler o .env ou um
 * backup dele não fica a saber a senha.
 *
 *   node senha.cjs 'a senha'
 */
const crypto = require("crypto");
const senha = process.argv[2];
if (!senha) {
  console.error("uso: node senha.cjs 'a senha'");
  process.exit(1);
}
const sal = crypto.randomBytes(16);
console.log(`scrypt:${sal.toString("hex")}:${crypto.scryptSync(senha, sal, 64).toString("hex")}`);
