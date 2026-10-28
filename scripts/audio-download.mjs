import { readFile, writeFile, rename, rm } from 'node:fs/promises'

export function driveDownloadUrl(value) {
  const url = new URL(value)
  if (!['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname)) return null
  const id = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get('id')
  if (!id || !/^[\w-]+$/.test(id)) throw new Error('Link do Drive sem ID de arquivo válido')
  return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
}

export function isOgg(bytes) {
  return bytes.length > 32 && bytes.subarray(0, 4).toString() === 'OggS'
}

export async function validCachedAudio(dest, source) {
  try {
    return isOgg(await readFile(dest)) && (await readFile(`${dest}.source`, 'utf8')) === source
  } catch {
    return false
  }
}

export async function downloadAudio(source, dest) {
  const response = await fetch(source, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!isOgg(bytes)) throw new Error('O Drive não entregou áudio OGG. Confira o compartilhamento e o arquivo.')
  const temporary = `${dest}.tmp`
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, dest)
    await writeFile(`${dest}.source`, source)
  } finally {
    await rm(temporary, { force: true })
  }
}
