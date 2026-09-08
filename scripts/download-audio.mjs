/**
 * Downloads all .ogg audio files from Google Drive to public/audio/
 * Run: node scripts/download-audio.mjs
 */
import { createWriteStream, readFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createReadStream } from 'fs'
import https from 'https'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const audioDir = join(__dirname, '..', 'public', 'audio')
const urlsFile = join(__dirname, 'drive-audio-urls.json')

// Read the URLs
const urls = JSON.parse(readFileSync(urlsFile, 'utf-8'))

await mkdir(audioDir, { recursive: true })

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

const CONCURRENCY = 5
const entries = Object.entries(urls)
let completed = 0
let failed = 0

console.log(`Downloading ${entries.length} audio files to public/audio/...`)

async function downloadOne(num, url) {
  const dest = join(audioDir, `salmo-${num}.ogg`)
  try {
    await downloadFile(url, dest)
    completed++
    process.stdout.write(`\r${completed}/${entries.length} downloaded, ${failed} failed`)
  } catch (e) {
    failed++
    console.error(`\nFailed salmo ${num}: ${e.message}`)
  }
}

// Process in batches
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  const batch = entries.slice(i, i + CONCURRENCY)
  await Promise.all(batch.map(([num, url]) => downloadOne(num, url)))
}

console.log(`\nDone! ${completed} downloaded, ${failed} failed.`)
