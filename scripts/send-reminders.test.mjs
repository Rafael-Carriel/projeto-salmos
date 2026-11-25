import test from 'node:test'
import assert from 'node:assert/strict'
import { DELETE_FIELD, sendReminders } from '../reminders/send-reminders.mjs'

const base = {
  cycleStartDate: '2026-10-28', lastReadDay: 0, lastReadDate: null,
  timezone: 'America/Sao_Paulo', notificationTimes: ['08:00', '12:30', '20:00'],
  fcmTokens: { 'test-token': 1 },
}

async function run({ time = '2026-10-28T11:00:00Z', profile = {}, dry = false, responses = [{ success: true }] } = {}) {
  const sends = []
  const updates = []
  const document = {
    id: 'test-account',
    data: () => ({ ...base, ...profile }),
    update: async (patch) => { updates.push(patch) },
  }
  const messaging = {
    async sendEachForMulticast(message) {
      sends.push(message)
      return { responses, successCount: responses.filter((response) => response.success).length }
    },
  }
  const result = await sendReminders({
    profiles: [document], messaging, appUrl: 'https://example.com', now: new Date(time), dryRun: dry,
  })
  return { sends, updates, result }
}

test('simulation never sends or changes a user profile', async () => {
  const result = await run({ dry: true })
  assert.equal(result.sends.length, 0)
  assert.equal(result.updates.length, 0)
  assert.deepEqual(result.result, { sent: 1, skipped: 0, failed: 0 })
})

test('reminders are never sent early and are sent when the local time is due', async () => {
  assert.equal((await run({ time: '2026-10-28T10:59:00Z' })).sends.length, 0)
  const result = await run()
  assert.equal(result.sends.length, 1)
  assert.equal(result.sends[0].data.title, 'Salmo 1')
  assert.equal(result.sends[0].notification.title, 'Salmo 1')
  assert.equal(result.sends[0].webpush.headers.Urgency, 'high')
  assert.deepEqual(result.updates[0].sentToday.slots, ['08:00'])
})

test('late scheduler runs combine due slots and never resend a recorded slot', async () => {
  const result = await run({ time: '2026-10-28T16:00:00Z' })
  assert.equal(result.sends.length, 1)
  assert.deepEqual(result.updates[0].sentToday.slots, ['08:00', '12:30'])
  assert.equal((await run({ profile: { sentToday: { date: '2026-10-28', slots: ['08:00'] } } })).sends.length, 0)
})

test('a saved 10:03 reminder is eligible at 10:03 and at the next server check', async () => {
  const profile = { notificationTimes: ['10:03', '12:30', '20:00'] }
  assert.equal((await run({ time: '2026-10-28T13:02:59Z', profile })).sends.length, 0)
  for (const time of ['2026-10-28T13:03:00Z', '2026-10-28T13:07:00Z']) {
    const result = await run({ time, profile })
    assert.equal(result.sends.length, 1)
    assert.equal(result.sends[0].data.reminderSlot, '10:03')
    assert.deepEqual(result.updates[0].sentToday.slots, ['10:03'])
  }
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
  assert.equal(result.updates.length, 1)
  assert.deepEqual(Object.keys(result.updates[0]), ['fcmTokens.test-token'])
  assert.equal(result.updates[0]['fcmTokens.test-token'], DELETE_FIELD)
})

test('invalid time zones and invalid reminder times do not crash or send early', async () => {
  assert.equal((await run({ profile: { timezone: 'invalid/timezone' } })).sends.length, 0)
  assert.equal((await run({ profile: { notificationTimes: ['25:00', '08:99', '8:00', 'bad'] } })).sends.length, 0)
})
