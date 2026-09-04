/* Mede a galeria presa: para cada passo da roda, quanto o scroll andou (dy) e
   quanto a tira andou (dx). Numa rolagem fluida a razão dx/dy é constante.
   Qualquer passo fora da linha é o "salto para dentro" que se vê no vídeo. */
const { chromium } = require('playwright')

;(async () => {
  const b = await chromium.launch()
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await p.goto('http://127.0.0.1:3211/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)

  const inicio = await p.evaluate(
    () => Math.round(document.querySelector('#hospital').getBoundingClientRect().top + scrollY) - 900,
  )
  await p.evaluate((y) => window.scrollTo(0, y), inicio)
  await p.waitForTimeout(1500)
  await p.mouse.move(720, 450)

  const s = []
  for (let i = 0; i < 130; i++) {
    await p.mouse.wheel(0, 120)
    await p.waitForTimeout(130) // deixa o scrub assentar antes de medir
    s.push(
      await p.evaluate(() => {
        const t = document.querySelector('#hospital [data-trilho-h]')
        return {
          y: Math.round(scrollY),
          x: Math.round(new DOMMatrixReadOnly(getComputedStyle(t).transform).m41),
          largura: t.scrollWidth,
          doc: document.documentElement.scrollHeight,
        }
      }),
    )
  }

  // Só os passos em que a tira estava mesmo a andar.
  const moveu = []
  for (let i = 1; i < s.length; i++) {
    const dy = s[i].y - s[i - 1].y
    const dx = s[i].x - s[i - 1].x
    if (dx !== 0 && dy > 0) moveu.push({ i, dy, dx, razao: dx / dy, y: s[i].y, x: s[i].x })
  }
  const razoes = moveu.map((m) => m.razao).sort((a, b) => a - b)
  const mediana = razoes[Math.floor(razoes.length / 2)]
  const foraDaLinha = moveu.filter((m) => Math.abs(m.razao - mediana) > Math.abs(mediana) * 0.6)

  console.log('largura da tira (início/fim):', s[0].largura, s.at(-1).largura)
  console.log('altura do doc (início/fim):', s[0].doc, s.at(-1).doc)
  console.log('razao dx/dy mediana:', mediana.toFixed(3), '| passos medidos:', moveu.length)
  console.log('passos fora da linha:', JSON.stringify(foraDaLinha.map((m) => ({ i: m.i, dy: m.dy, dx: m.dx, razao: +m.razao.toFixed(2) }))))
  const recuos = []
  for (let i = 1; i < s.length; i++) if (s[i].y < s[i - 1].y - 3) recuos.push({ i, de: s[i - 1].y, para: s[i].y })
  console.log('recuos de scroll:', JSON.stringify(recuos))
  await b.close()
})()
