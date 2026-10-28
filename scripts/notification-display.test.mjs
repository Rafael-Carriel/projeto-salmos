import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'

const raw = await readFile(new URL('../src/lib/notificationDisplay.ts', import.meta.url), 'utf8')
const source = ts.transpileModule(raw, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText

async function load({ permission = 'granted', permissionMode = 'promise', event = 'show', mobile = false } = {}) {
  const calls = { requested: 0, direct: 0, worker: 0, options: null }
  class FakeNotification {
    static permission = permission
    static requestPermission(callback) {
      calls.requested++
      if (permissionMode === 'callback') { callback('granted'); return undefined }
      if (permissionMode === 'pending') {
        setTimeout(() => { this.permission = 'granted' }, 1)
        return new Promise(() => {})
      }
      return Promise.resolve('granted')
    }
    constructor(_title, options) {
      calls.direct++
      calls.options = options
      queueMicrotask(() => {
        if (event === 'show') this.onshow?.()
        if (event === 'error') this.onerror?.()
      })
    }
    close() {}
  }
  const context = createContext({
    Notification: FakeNotification, TypeError, queueMicrotask, clearTimeout, clearInterval,
    setTimeout: (callback, ms) => setTimeout(callback, Math.min(ms, 40)),
    setInterval: (callback, ms) => setInterval(callback, Math.min(ms, 5)),
    navigator: { userAgent: mobile ? 'Android' : 'Windows Chrome', serviceWorker: {
      register: async () => ({ active: { state: 'activated' }, showNotification: async (_title, options) => { calls.worker++; calls.options = options } }),
    } }, window: { focus() {} },
  })
  const module = new SourceTextModule(source, { context })
  await module.link(() => new SyntheticModule(['pushTimeout'], function () {
    this.setExport('pushTimeout', async (promise) => promise)
  }, { context }))
  await module.evaluate()
  return { api: module.namespace, calls }
}

test('an existing notification permission is used without requesting it again', async () => {
  const { api, calls } = await load()
  assert.equal(await api.requestNotificationPermission(), 'granted')
  assert.equal(calls.requested, 0)
})

test('legacy callbacks and a pending browser promise both resolve when permission is granted', async () => {
  for (const permissionMode of ['callback', 'pending']) {
    const { api } = await load({ permission: 'default', permissionMode })
    assert.equal(await api.requestNotificationPermission(), 'granted')
  }
})

test('desktop display waits for show and does not depend on Firebase registration', async () => {
  const { api, calls } = await load()
  await api.displayNotification('Test', 'Body')
  assert.equal(calls.direct, 1)
  assert.equal(calls.worker, 0)
  assert.equal(calls.options.requireInteraction, true)
})

test('a browser that never displays the notification cannot report test success', async () => {
  const { api } = await load({ event: 'none' })
  await assert.rejects(api.displayNotification('Test', 'Body'), /não confirmou/)
})

test('native display errors are surfaced instead of claiming success', async () => {
  const { api } = await load({ event: 'error' })
  await assert.rejects(api.displayNotification('Test', 'Body'), /falha ao exibir/)
})

test('mobile display uses a lightweight worker without loading Firebase', async () => {
  const { api, calls } = await load({ mobile: true })
  await api.displayNotification('Test', 'Body')
  assert.equal(calls.direct, 0)
  assert.equal(calls.worker, 1)
})
