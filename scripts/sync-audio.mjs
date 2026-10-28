/** Copies and validates Drive narrations without changing their source URLs. */
import { readFileSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { driveDownloadUrl, downloadAudio, validCachedAudio, isOgg } from './audio-download.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const audioDir = join(root, 'public', 'audio')

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    ?? readFileSync(join(process.env.USERPROFILE || process.env.HOME, 'AppData/Local/Temp/firebase-service-account.json'), 'utf8')
  initializeApp({ credential: cert(JSON.parse(raw)) })
  const urls = (await getFirestore().doc('content/audio').get()).data()?.urls ?? {}
  await mkdir(audioDir, { recursive: true })
  let downloaded = 0
  let skipped = 0
  let failed = 0
  for (const [num, value] of Object.entries(urls)) {
    try {
      if (!/^(?:[1-9]|[1-9]\d|1[0-4]\d|150)$/.test(num)) throw new Error('Número de salmo inválido')
      if (!value) continue
      if (value.startsWith('/audio/')) {
        if (!isOgg(await readFile(join(audioDir, `salmo-${num}.ogg`)))) throw new Error('Áudio local ausente ou inválido; cadastre novamente o link original do Drive')
        skipped++
        continue
      }
      const source = driveDownloadUrl(value)
      if (!source) { skipped++; continue }
      const dest = join(audioDir, `salmo-${num}.ogg`)
      if (!process.argv.includes('--force') && await validCachedAudio(dest, source)) {
        skipped++
        continue
      }
      await downloadAudio(source, dest)
      downloaded++
      console.log(`Salmo ${num}: áudio validado`)
    } catch (error) {
      failed++
      console.error(`Salmo ${num}: ${error.message}`)
    }
  }
  console.log(`${downloaded} downloaded, ${skipped} skipped, ${failed} failed`)
  if (failed) throw new Error('Publicação interrompida: há narrações inválidas ou ausentes')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
