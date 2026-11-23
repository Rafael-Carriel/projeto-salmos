import { deriveCycle, type UserProfile } from './cycle'

export function reminderAt(profile: UserProfile, now = new Date()) {
  if (!profile.notificationsEnabled) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: profile.timezone || 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: string) => parts.find((part) => part.type === type)?.value
  const date = `${value('year')}-${value('month')}-${value('day')}`
  const slot = `${value('hour')}:${value('minute')}`
  if (!profile.notificationTimes.includes(slot)) return null
  if (profile.sentToday?.date === date && profile.sentToday.slots.includes(slot)) return null
  const cycle = deriveCycle(profile, date)
  if (cycle.status !== 'pending') return null
  return { date, slot, title: `Salmo ${cycle.day}`, body: 'Seu salmo de hoje está aberto.' }
}

/** Shared by tabs of this browser, kept only for the most recent day. */
export function claimReminder(uid: string, date: string, slot: string): boolean {
  const key = `salmos:reminders:${uid}`
  try {
    const previous = JSON.parse(localStorage.getItem(key) ?? 'null')
    const slots: string[] = previous?.date === date && Array.isArray(previous.slots) ? previous.slots : []
    if (slots.includes(slot)) return false
    localStorage.setItem(key, JSON.stringify({ date, slots: [...slots, slot] }))
  } catch {
    // A browser without storage can still display the incoming server message.
  }
  return true
}
