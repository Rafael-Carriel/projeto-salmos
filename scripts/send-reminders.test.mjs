import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

const source = await readFile(new URL('./send-reminders.mjs', import.meta.url), 'utf8')
const base = {
  cycleStartDate: '2026-10-28', lastReadDay: 0, lastReadDate: null,
  timezone: 'America/Sao_Paulo', notificationTimes: ['08:00', '12:30', '20:00'],
  fcmTokens: { 'test-token': 1 },
}

async function run({ time = '2026-10-28T11:00:00Z', profile = {}, dry = false, responses = [{ success: true }] } = {}) {
  const sends = [], updates = [], logs = []
  const document = { id: 'test-account', data: () => ({ ...base, ...profile }), ref: { update: async (patch) => updates.push(patch) } }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [time])) } }
  const context = createContext({
    Date: FixedDate, Intl,
    process: { env: { FIREBASE_SERVICE_ACCOUNT: '{}', APP_URL: 'https://example.com', DRY_RUN: dry ? '1' : '0' }, argv: [] },
    console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
  })
  const modules = {
    'firebase-admin/app': { cert: (value) => value, initializeApp: () => {} },
    'firebase-admin/firestore': { FieldValue: { delete: () => 'DELETE' }, getFirestore: () => ({ collection: () => ({ where: () => ({ get: async () => ({ docs: [document] }) }) }) }) },
    'firebase-admin/messaging': { getMessaging: () => ({ sendEachForMulticast: async (message) => {
      sends.push(message)
      return { responses, successCount: responses.filter((r) => r.success).length }
    } }) },
  }
  const module = new SourceTextModule(source, { context })
  await module.link((specifier) => {
    const values = modules[specifier]
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return JSON.parse(JSON.stringify({ sends, updates, logs }))
}

test('simulation never sends or changes a user profile', async () => {
  const result = await run({ dry: true })
  assert.equal(result.sends.length, 0)
  assert.equal(result.updates.length, 0)
  assert.ok(result.logs.some((line) => line.includes('[simulação] 1')))
})

test('reminders are never sent early and are sent when the local time is due', async () => {
  assert.equal((await run({ time: '2026-10-28T10:59:00Z' })).sends.length, 0)
  const result = await run()
  assert.equal(result.sends.length, 1)
  assert.equal(result.sends[0].data.title, 'Salmo 1')
  assert.deepEqual(result.updates[0].sentToday.slots, ['08:00'])
})

test('late scheduler runs combine due slots and never resend a recorded slot', async () => {
  const result = await run({ time: '2026-10-28T16:00:00Z' })
  assert.equal(result.sends.length, 1)
  assert.deepEqual(result.updates[0].sentToday.slots, ['08:00', '12:30'])
  assert.equal((await run({ profile: { sentToday: { date: '2026-10-28', slots: ['08:00'] } } })).sends.length, 0)
})

test('reading today, losing the cycle, completing it or having no token prevents sends', async () => {
  for (const profile of [
    { lastReadDate: '2026-10-28' }, { cycleStartDate: '2026-09-08', lastReadDay: 1 },
    { lastReadDay: 150 }, { fcmTokens: {} }, { cycleStartDate: null },
  ]) assert.equal((await run({ profile })).sends.length, 0)
})

test('a failed delivery remains eligible and does not delete a token for payload errors', async () => {
  const result = await run({ responses: [{ success: false, error: { code: 'messaging/invalid-argument' } }] })
  assert.equal(result.updates.length, 0)
})

test('expired registration tokens are removed without recording a successful delivery', async () => {
  const result = await run({ responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }] })
  assert.deepEqual(result.updates, [{ 'fcmTokens.test-token': 'DELETE' }])
})

test('invalid time zones and invalid reminder times do not crash or send early', async () => {
  assert.equal((await run({ profile: { timezone: 'invalid/timezone' } })).sends.length, 0)
  assert.equal((await run({ profile: { notificationTimes: ['25:00', '08:99', '8:00', 'bad'] } })).sends.length, 0)
})
