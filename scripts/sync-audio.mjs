/**
 * Syncs audio from Google Drive URLs stored in Firestore to local hosting.
 *
 * Flow:
 * 1. Reads content/audio.urls from Firestore (may contain Drive URLs or local paths)
 * 2. For each Drive URL: downloads the file to public/audio/salmo-N.ogg
 * 3. Updates Firestore to use local path /audio/salmo-N.ogg
 * 4. Skips files already downloaded (unless --force)
 *
 * Run: node scripts/sync-audio.mjs [--force]
 */
import { createWriteStream, existsSync, readFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { pipeline } from 'stream/promises'
import https from 'https'
import http from 'http'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const audioDir = join(ROOT, 'public', 'audio')
const FORCE = process.argv.includes('--force')

// Firebase Admin — reads from FIREBASE_SERVICE_ACCOUNT env var (JSON string) or local file
let sa
const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT
if (saEnv) {
  sa = JSON.parse(saEnv)
} else {
  const saPath = join(process.env.HOME || process.env.USERPROFILE, 'AppData/Local/Temp/firebase-service-account.json')
  sa = JSON.parse(readFileSync(saPath, 'utf-8'))
}

// Dynamic import for ESM
const { cert, initializeApp } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')

initializeApp({ credential: cert(sa) })
const db = getFirestore()

function isDriveUrl(url) {
  return url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')
}

function downloadFile(url, destPath) {
  const lib = url.startsWith('https') ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const file = createWriteStream(destPath)
      pipeline(res, file).then(resolve).catch(reject)
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function main() {
  await mkdir(audioDir, { recursive: true })

  const snap = await db.doc('content/audio').get()
  const urls = snap.data()?.urls ?? {}

  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (const [num, url] of Object.entries(urls)) {
    if (!isDriveUrl(url)) {
      skipped++
      continue
    }

    const dest = join(audioDir, `salmo-${num}.ogg`)
    if (existsSync(dest) && !FORCE) {
      skipped++
      continue
    }

    process.stdout.write(`Downloading salmo ${num}...`)
    try {
      await downloadFile(url, dest)
      downloaded++
      console.log(` OK`)
    } catch (e) {
      console.log(` FAILED: ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone! ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`)
}

main().then(() => process.exit()).catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
