import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import {
  DEFAULT_NOTIFICATION_TIMES,
  TOTAL_PSALMS,
  deriveCycle,
  todayKey,
  type CycleState,
  type UserProfile,
} from '../lib/cycle'
import { useAuth } from './useAuth'

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

function newProfile(uid: string, base: Partial<UserProfile>): UserProfile {
  return {
    uid,
    email: base.email ?? null,
    displayName: base.displayName ?? null,
    photoURL: base.photoURL ?? null,
    createdAt: Date.now(),
    cycleStartDate: null,
    lastReadDay: 0,
    lastReadDate: null,
    bestDay: 0,
    resets: 0,
    completedCycles: 0,
    favorites: [],
    notificationsEnabled: false,
    notificationTimes: DEFAULT_NOTIFICATION_TIMES,
    timezone: localTimezone(),
  }
}

export type ProfileState = {
  profile: UserProfile | null
  cycle: CycleState
  loading: boolean
  /** true enquanto as escritas locais ainda não chegaram ao servidor. */
  pendingSync: boolean
  startCycle: () => Promise<void>
  markRead: (day: number) => Promise<void>
  toggleFavorite: (psalm: number) => Promise<void>
  saveNotificationSettings: (patch: {
    notificationsEnabled?: boolean
    notificationTimes?: string[]
  }) => Promise<void>
}

export function useProfile(): ProfileState {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingSync, setPendingSync] = useState(false)
  // Reavalia o ciclo à meia-noite sem precisar recarregar a página.
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    const id = setInterval(() => setToday(todayKey()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const ref = doc(db, 'users', user.uid)
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        setPendingSync(snap.metadata.hasPendingWrites)
        if (!snap.exists()) {
          // Primeiro acesso: cria o perfil. Funciona offline (fica na fila).
          const created = newProfile(user.uid, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          })
          void setDoc(ref, created, { merge: true })
          setProfile(created)
        } else {
          setProfile({ ...newProfile(user.uid, {}), ...(snap.data() as UserProfile) })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Falha ao ler o perfil:', err)
        setLoading(false)
      },
    )
  }, [user])

  const cycle = useMemo(() => deriveCycle(profile, today), [profile, today])

  const startCycle = useCallback(async () => {
    if (!user) return
    const lostCycle = Boolean(profile?.cycleStartDate) && cycle.status === 'not-started'
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'users', user.uid)
      const snap = await tx.get(ref)
      const current = (snap.data() as UserProfile | undefined) ?? newProfile(user.uid, {})
      tx.set(
        ref,
        {
          ...current,
          cycleStartDate: todayKey(),
          lastReadDay: 0,
          lastReadDate: null,
          resets: current.resets + (lostCycle ? 1 : 0),
        },
        { merge: true },
      )
    })
  }, [user, profile, cycle.status])

  const markRead = useCallback(
    async (day: number) => {
      if (!user) return
      const date = todayKey()
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'users', user.uid)
        const snap = await tx.get(ref)
        const current = snap.data() as UserProfile | undefined
        if (!current) return
        // Só avança se o dia enviado é realmente o próximo — evita marcar
        // duas vezes ou pular salmo com duas abas abertas.
        if (current.lastReadDate === date || day !== current.lastReadDay + 1) return
        tx.set(
          ref,
          {
            lastReadDay: day,
            lastReadDate: date,
            bestDay: Math.max(current.bestDay ?? 0, day),
            completedCycles: (current.completedCycles ?? 0) + (day === TOTAL_PSALMS ? 1 : 0),
          },
          { merge: true },
        )
        tx.set(doc(db, 'users', user.uid, 'readings', date), {
          day,
          psalm: day,
          date,
          readAt: serverTimestamp(),
        })
      })
    },
    [user],
  )

  const toggleFavorite = useCallback(
    async (psalm: number) => {
      if (!user) return
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'users', user.uid)
        const snap = await tx.get(ref)
        const current = snap.data() as UserProfile | undefined
        const favorites = new Set(current?.favorites ?? [])
        if (favorites.has(psalm)) favorites.delete(psalm)
        else favorites.add(psalm)
        tx.set(ref, { favorites: [...favorites].sort((a, b) => a - b) }, { merge: true })
      })
    },
    [user],
  )

  const saveNotificationSettings = useCallback(
    async (patch: { notificationsEnabled?: boolean; notificationTimes?: string[] }) => {
      if (!user) return
      await setDoc(
        doc(db, 'users', user.uid),
        { ...patch, timezone: localTimezone() },
        { merge: true },
      )
    },
    [user],
  )

  return {
    profile,
    cycle,
    loading,
    pendingSync,
    startCycle,
    markRead,
    toggleFavorite,
    saveNotificationSettings,
  }
}
