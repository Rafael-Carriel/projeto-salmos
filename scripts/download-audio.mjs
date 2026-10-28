/** Download the original URL manifest using the same validation as deployment. */
import { readFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { driveDownloadUrl, downloadAudio } from './audio-download.mjs'

const directory = new URL('../public/audio/', import.meta.url)
await mkdir(directory, { recursive: true })
const urls = JSON.parse(await readFile(new URL('./drive-audio-urls.json', import.meta.url), 'utf8'))
let failed = 0
for (const [num, value] of Object.entries(urls)) {
  try {
    const source = driveDownloadUrl(value)
    if (!source) throw new Error('Link não pertence ao Google Drive')
    await downloadAudio(source, fileURLToPath(new URL(`salmo-${num}.ogg`, directory)))
    console.log(`Salmo ${num}: áudio validado`)
  } catch (error) {
    failed++
    console.error(`Salmo ${num}: ${error.message}`)
  }
}
if (failed) process.exitCode = 1
