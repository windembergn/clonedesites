/* Verifica que o formulário exige e-mail e telemóvel, e que os dois chegam ao
   webhook.

   Nada sai da máquina: o webhook do Make, o link de rastreio da Tintim e o
   pixel da Meta são todos interceptados. O teste não gera lead nem registo
   real em serviço nenhum. */
const { chromium } = require('playwright')

const URL_BASE = process.argv[2] || 'http://127.0.0.1:3211/'
let falhas = 0
const ok = (t) => console.log('  ok   ', t)
const erro = (t, d) => { falhas++; console.log('  FALHA', t, d === undefined ? '' : JSON.stringify(d)) }

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()

  const enviados = []
  await p.route('**://hook*.make.com/**', async (r) => {
    enviados.push(JSON.parse(r.request().postData() || 'null'))
    await r.fulfill({ status: 200, contentType: 'text/plain', body: 'accepted' })
  })
  let foiParaWhatsapp = 0
  await p.route('**://tintim.link/**', async (r) => {
    foiParaWhatsapp++
    await r.fulfill({ status: 200, contentType: 'text/html', body: '<title>whatsapp falso</title>' })
  })
  await p.route('**connect.facebook.net**', (r) => r.abort())
  await p.route('**facebook.com/tr**', (r) => r.abort())

  await p.goto(URL_BASE, { waitUntil: 'domcontentloaded' })
  await p.locator('#contacto').scrollIntoViewIfNeeded()
  await p.waitForTimeout(600)

  const campo = (id) => p.locator(`#${id}`)
  const valido = (id) => campo(id).evaluate((e) => e.checkValidity())
  const botao = p.locator('form.formulario button[type=submit]')

  console.log('1. campos obrigatórios')
  for (const id of ['email', 'telefone']) {
    if (await campo(id).count() === 0) { erro(`campo #${id} existe`); continue }
    const req = await campo(id).evaluate((e) => e.required)
    req ? ok(`#${id} é obrigatório`) : erro(`#${id} é obrigatório`, req)
  }

  console.log('2. vazio não envia')
  await campo('nome').fill('Ana Machava')
  await campo('cidade').fill('Maputo, Moçambique')
  await botao.click()
  await p.waitForTimeout(900)
  enviados.length === 0 ? ok('nada foi para o webhook') : erro('nada foi para o webhook', enviados)
  foiParaWhatsapp === 0 ? ok('não encaminhou para o WhatsApp') : erro('não encaminhou', foiParaWhatsapp)

  console.log('3. e-mail malformado é recusado')
  await campo('email').fill('ana@')
  await valido('email') === false ? ok('"ana@" recusado') : erro('"ana@" recusado')

  console.log('4. telemóvel curto é recusado')
  await campo('email').fill('ana.machava@exemplo.mz')
  await campo('telefone').fill('8412')
  await p.waitForTimeout(100)
  await valido('telefone') === false ? ok('"8412" recusado') : erro('"8412" recusado')
  await botao.click()
  await p.waitForTimeout(700)
  enviados.length === 0 ? ok('ainda nada no webhook') : erro('ainda nada no webhook', enviados)

  console.log('5. preenchido envia e encaminha')
  await campo('telefone').fill('84 123 4567')
  await p.waitForTimeout(100)
  await valido('telefone') === true ? ok('"84 123 4567" aceite') : erro('"84 123 4567" aceite')
  await campo('mensagem').fill('Gostava de saber sobre a recuperação.')
  await botao.click()
  await p.waitForTimeout(2500)

  if (enviados.length !== 1) { erro('um pedido para o webhook', enviados.length) }
  else {
    const corpo = enviados[0]
    Array.isArray(corpo) && corpo.length === 1 ? ok('corpo é array de um item') : erro('corpo é array de um item', corpo)
    const d = Array.isArray(corpo) ? corpo[0] : corpo
    const esperado = {
      nome: 'Ana Machava',
      email: 'ana.machava@exemplo.mz',
      telefone: '84 123 4567',
      phone: '84 123 4567',
      whatsapp: '258841234567',
      cidade: 'Maputo, Moçambique',
      pais: 'Moçambique',
      origem: 'lp-mocambique',
    }
    for (const [k, v] of Object.entries(esperado)) {
      d[k] === v ? ok(`${k} = ${JSON.stringify(v)}`) : erro(`${k} = ${JSON.stringify(v)}`, d[k])
    }
    console.log('  payload:', JSON.stringify(d, null, 2).split('\n').join('\n  '))
  }
  foiParaWhatsapp === 1 ? ok('encaminhou para o link da Tintim') : erro('encaminhou para a Tintim', foiParaWhatsapp)

  /* Guarda o corpo interceptado. Serve para alimentar o `planilha.cjs` sem
     inventar um payload à mão: o que vai para a planilha no teste é byte a byte
     o que a página mandaria para o Make. */
  const destino = process.argv[3]
  if (destino && enviados[0]) {
    require('fs').writeFileSync(destino, JSON.stringify(enviados[0], null, 2))
    console.log('  payload guardado em', destino)
  }

  await b.close()
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou. Nenhum pedido real foi disparado: Make, Tintim e pixel da Meta ficaram interceptados.')
  process.exit(falhas ? 1 : 0)
})()
