/**
 * Baixa os 150 salmos da bible-api.com (tradução Almeida, domínio público)
 * e gera public/psalms.json — usado offline pelo app, sem nenhuma leitura
 * do Firestore para o texto.
 *
 *   node scripts/fetch-psalms.mjs
 *
 * A API limita a ~15 requisições por 30s, então o script anda devagar
 * (uns 6 minutos), salva o progresso a cada salmo e pode ser reexecutado
 * para retomar de onde parou.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/psalms.json')
const TOTAL = 150
const THROTTLE_MS = 2200 // abaixo do limite de 15 req / 30s
const MAX_ATTEMPTS = 6

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPsalm(n, attempt = 1) {
  const url = `https://bible-api.com/salmos+${n}?translation=almeida`
  try {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = 30_000 * attempt
      process.stdout.write(` [429, aguardando ${wait / 1000}s]`)
      await sleep(wait)
      throw new Error('HTTP 429')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!Array.isArray(json.verses) || json.verses.length === 0) {
      throw new Error('resposta sem versículos')
    }
    return {
      number: n,
      reference: json.reference,
      verses: json.verses.map((v) => ({
        number: v.verse,
        text: v.text.replace(/\s+/g, ' ').trim(),
      })),
    }
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Salmo ${n} falhou: ${err.message}`)
    await sleep(1500 * attempt)
    return fetchPsalm(n, attempt + 1)
  }
}

async function loadExisting() {
  try {
    const parsed = JSON.parse(await readFile(OUT, 'utf8'))
    const byNumber = new Map()
    for (const p of parsed) {
      if (p?.number && p.verses?.length) byNumber.set(p.number, p)
    }
    return byNumber
  } catch {
    return new Map()
  }
}

async function save(byNumber) {
  const list = [...byNumber.values()].sort((a, b) => a.number - b.number)
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(list), 'utf8')
  return list
}

const byNumber = await loadExisting()
if (byNumber.size) console.log(`Retomando: ${byNumber.size} salmos já baixados.`)

for (let n = 1; n <= TOTAL; n++) {
  if (byNumber.has(n)) continue
  byNumber.set(n, await fetchPsalm(n))
  await save(byNumber)
  process.stdout.write(`\rSalmo ${n}/${TOTAL} (${byNumber.size} prontos)`)
  await sleep(THROTTLE_MS)
}

const list = await save(byNumber)
const missing = []
for (let n = 1; n <= TOTAL; n++) if (!byNumber.has(n)) missing.push(n)
if (missing.length) {
  console.error(`\nFaltando: ${missing.join(', ')}. Rode o script de novo.`)
  process.exit(1)
}

const verses = list.reduce((acc, p) => acc + p.verses.length, 0)
console.log(`\n${list.length} salmos, ${verses} versículos -> public/psalms.json`)
