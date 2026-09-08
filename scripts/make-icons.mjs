/**
 * Gera os ícones do PWA a partir de um SVG — a lira, instrumento dos salmos,
 * em ouro sobre ultramarino, os dois pigmentos dos saltérios medievais.
 *
 *   node scripts/make-icons.mjs
 *
 * A versão "maskable" recolhe o desenho para dentro da zona segura circular
 * que o Android recorta.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/icons')

const INK = '#101a45'
const GILT = '#c39b4a'

/**
 * A harpa de Davi. O contorno assimétrico — coluna reta à esquerda, braço
 * curvo no alto, caixa de ressonância descendo à direita — é o que a
 * distingue de um cesto ou de um tambor. As cordas encurtam da esquerda
 * para a direita, como nas harpas de verdade.
 *
 * @param {number} inset Margem em unidades do viewBox de 512.
 */
function harp(inset) {
  const s = (512 - inset * 2) / 512
  // Topos calculados sobre a cúbica do braço, com folga para a espessura do
  // traço — senão as cordas furam a moldura. Embaixo, as quatro primeiras
  // encostam no pé e as duas últimas na caixa, que sobe à direita.
  const strings = [
    [200, 155, 385],
    [226, 150, 385],
    [252, 149, 385],
    [278, 154, 385],
    [304, 166, 378],
    [330, 190, 276],
  ]
    .map(([x, top, bottom]) => `<path d="M${x} ${top} L${x} ${bottom}"/>`)
    .join('\n      ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${INK}"/>
  <g transform="translate(${inset} ${inset}) scale(${s})"
     fill="none" stroke="${GILT}" stroke-linecap="round" stroke-linejoin="round">
    <g stroke-width="7" opacity="0.88">
      ${strings}
    </g>
    <!-- coluna, braço curvo, caixa e pé: um traço contínuo -->
    <path d="M168 400 L176 150 C 250 116 330 146 350 214 L302 400 Z" stroke-width="22"/>
  </g>
</svg>`
}

await mkdir(OUT, { recursive: true })

const jobs = [
  { file: 'icon-192.png', size: 192, svg: harp(28) },
  { file: 'icon-512.png', size: 512, svg: harp(28) },
  { file: 'icon-512-maskable.png', size: 512, svg: harp(88) },
]

for (const { file, size, svg } of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(OUT, file))
  console.log(`${file} (${size}×${size})`)
}

await writeFile(resolve(ROOT, 'public/favicon.svg'), harp(28), 'utf8')
console.log('favicon.svg')
