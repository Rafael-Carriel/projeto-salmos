import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { driveDownloadUrl, downloadAudio, isOgg, validCachedAudio } from './audio-download.mjs'

test('both Drive link formats resolve to the same audio download', () => {
  const expected = 'https://drive.usercontent.google.com/download?id=abc-123&export=download&confirm=t'
  assert.equal(driveDownloadUrl('https://drive.google.com/file/d/abc-123/view?usp=drive_link'), expected)
  assert.equal(driveDownloadUrl(expected), expected)
  assert.equal(driveDownloadUrl('https://example.com/audio.ogg'), null)
  assert.throws(() => driveDownloadUrl('https://drive.google.com/'))
  assert.equal(isOgg(Buffer.from('<html>permission required</html>')), false)
})

test('HTML downloads never replace audio; stale and corrupt caches are rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'salmos-audio-'))
  const dest = join(directory, 'salmo-97.ogg')
  const audio = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64)])
  const source = 'data:audio/ogg;base64,' + audio.toString('base64')
  try {
    await downloadAudio(source, dest)
    assert.equal(await validCachedAudio(dest, source), true)
    assert.equal(await validCachedAudio(dest, 'changed-source'), false)
    await assert.rejects(downloadAudio('data:text/html,<html>Drive page</html>', dest))
    assert.deepEqual(await readFile(dest), audio)
    await writeFile(dest, '<html>cached page</html>')
    assert.equal(await validCachedAudio(dest, source), false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
