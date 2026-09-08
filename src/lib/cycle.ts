export const TOTAL_PSALMS = 150

export type Psalm = {
  number: number
  reference: string
  verses: { number: number; text: string }[]
}

export type UserProfile = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: number
  /** Data local (YYYY-MM-DD) em que o ciclo atual começou. null = nunca iniciou. */
  cycleStartDate: string | null
  /** Número do último salmo lido no ciclo atual (0 = nenhum ainda). */
  lastReadDay: number
  /** Data local (YYYY-MM-DD) da última leitura. */
  lastReadDate: string | null
  /** Maior dia alcançado em qualquer tentativa — o recorde pessoal. */
  bestDay: number
  /** Quantas vezes o ciclo foi zerado por dia perdido. */
  resets: number
  /** Quantas vezes completou os 150. */
  completedCycles: number
  favorites: number[]
  notificationsEnabled: boolean
  /** Horários locais "HH:MM" em que o usuário quer ser lembrado. */
  notificationTimes: string[]
  /** IANA, ex. "America/Sao_Paulo" — usado pelo agendador de push. */
  timezone: string
}

export const DEFAULT_NOTIFICATION_TIMES = ['07:00', '12:30', '20:00']

/** Estado derivado do perfil + data de hoje. Nunca é persistido. */
export type CycleState =
  | { status: 'not-started' }
  | {
      status: 'pending' | 'done-today' | 'cycle-complete'
      /** Dia do ciclo, 1..150. */
      day: number
      /** Salmos já liberados neste ciclo: 1..unlockedThrough. */
      unlockedThrough: number
    }

export function todayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Dias inteiros entre duas datas locais YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)
  return Math.round(ms / 86_400_000)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`
}

/**
 * Traduz o perfil salvo no estado de hoje.
 *
 * A regra do ciclo: no dia N desde o início, o salmo do dia é o N.
 * Se o usuário deixou passar a virada de um dia sem marcar a leitura,
 * o ciclo foi perdido e precisa voltar ao Salmo 1 — sinalizado aqui por
 * `status: 'not-started'`, já que o ciclo antigo não vale mais.
 */
export function deriveCycle(profile: UserProfile | null, today = todayKey()): CycleState {
  if (!profile?.cycleStartDate) return { status: 'not-started' }

  const elapsed = daysBetween(profile.cycleStartDate, today)
  // Relógio do aparelho atrasado/adiantado: trata como o dia do início.
  const expectedDay = Math.max(1, elapsed + 1)

  if (profile.lastReadDay >= TOTAL_PSALMS) {
    return { status: 'cycle-complete', day: TOTAL_PSALMS, unlockedThrough: TOTAL_PSALMS }
  }

  // Já leu o salmo de hoje.
  if (profile.lastReadDate === today) {
    return { status: 'done-today', day: profile.lastReadDay, unlockedThrough: profile.lastReadDay }
  }

  // Para o ciclo estar vivo, tudo até ontem precisa ter sido lido.
  if (profile.lastReadDay < expectedDay - 1) return { status: 'not-started' }

  return { status: 'pending', day: expectedDay, unlockedThrough: expectedDay }
}

/** Quanto falta para a virada do dia, em ms — usado pelo aviso de "última chance". */
export function msUntilMidnight(now = new Date()): number {
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}
