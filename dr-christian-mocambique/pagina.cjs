/* Percorre a página inteira com a roda, sem pausas longas, e regista tudo o que
   pode causar um salto: recuo do scroll e mudança de altura do documento. */
const { chromium } = require('playwright')

;(async () => {
  const largura = Number(process.argv[2] || 1440)
  const altura = Number(process.argv[3] || 900)
  const passo = Number(process.argv[4] || 120)
  const espera = Number(process.argv[5] || 40)

  const b = await chromium.launch()
  const p = await (await b.newContext({ viewport: { width: largura, height: altura } })).newPage()
  await p.goto((process.env.URL_PAGINA || 'http://127.0.0.1:3211/'), { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  await p.mouse.move(largura / 2, altura / 2)

  const s = []
  for (let i = 0; i < 600; i++) {
    await p.mouse.wheel(0, passo)
    await p.waitForTimeout(espera)
    const m = await p.evaluate(() => ({ y: Math.round(scrollY), doc: document.documentElement.scrollHeight }))
    s.push(m)
    if (m.y >= (await p.evaluate(() => document.documentElement.scrollHeight - innerHeight - 2))) break
  }

  const recuos = []
  const mudancas = []
  for (let i = 1; i < s.length; i++) {
    if (s[i].y < s[i - 1].y - 3) recuos.push({ i, de: s[i - 1].y, para: s[i].y, delta: s[i].y - s[i - 1].y })
    if (s[i].doc !== s[i - 1].doc) mudancas.push({ i, y: s[i].y, de: s[i - 1].doc, para: s[i].doc })
  }
  console.log(`viewport ${largura}x${altura} passo ${passo} espera ${espera}ms | amostras ${s.length} | y ${s[0].y} -> ${s.at(-1).y}`)
  console.log('recuos de scroll:', recuos.length ? JSON.stringify(recuos) : 'nenhum')
  console.log('mudancas de altura do documento:', mudancas.length ? JSON.stringify(mudancas) : 'nenhuma')
  await b.close()
})()
