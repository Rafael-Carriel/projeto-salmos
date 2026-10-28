import { deleteField, doc, runTransaction, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { app, db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export type PushStatus =
  | 'unsupported' // navegador sem suporte (ex. iOS fora da tela inicial)
  | 'default' // ainda não perguntamos
  | 'granted'
  | 'denied' // bloqueado nas configurações do navegador

export function pushStatus(): PushStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission as PushStatus
}

/** Account-wide settings do not mean this particular browser is registered. */
export function pushEnabledOnDevice(tokens: Record<string, number> = {}): boolean {
  const token = localStorage.getItem('salmos:fcmToken')
  return pushStatus() === 'granted' && Boolean(token && token in tokens)
}

/** Displays a real browser notification on this device, without messaging others. */
export async function showTestNotification(): Promise<void> {
  if (pushStatus() !== 'granted') {
    throw new Error('Ative os lembretes neste navegador em Ajustes antes de testar.')
  }
  const registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')
  if (!registration?.active || new URL(registration.active.scriptURL).pathname !== '/firebase-messaging-sw.js') {
    throw new Error('Este aparelho ainda não está registrado. Ative os lembretes em Ajustes.')
  }
  await registration.showNotification('Teste — Projeto Salmos', {
    body: 'As notificações deste aparelho estão funcionando.',
    icon: '/icons/icon-192.png',
    tag: 'salmos-teste',
    data: { url: '/' },
  })
}

/** iOS só entrega push se o PWA estiver instalado na tela inicial. */
export function needsInstallForPush(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  return isIOS && !installed
}

/**
 * Pede permissão, registra o token do FCM e o guarda no perfil.
 * O agendador (GitHub Actions) lê esses tokens para enviar os lembretes.
 */
export async function enablePush(uid: string): Promise<PushStatus> {
  if (!(await isSupported())) return 'unsupported'
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY não definida — push desativado.')
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission as PushStatus

  // public/ não passa pelo Vite, então a config vai na query string.
  // São valores públicos do projeto — nada sigiloso trafega aqui.
  const config = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${config}`,
    { scope: '/firebase-cloud-messaging-push-scope' },
  )
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) return 'denied'

  await setDoc(
    doc(db, 'users', uid),
    {
      notificationsEnabled: true,
      fcmTokens: { [token]: Date.now() },
    },
    { merge: true },
  )
  localStorage.setItem('salmos:fcmToken', token)
  return 'granted'
}

/** Remove o token deste aparelho — o usuário para de receber push aqui. */
export async function disablePush(uid: string): Promise<void> {
  const token = localStorage.getItem('salmos:fcmToken')
  if (!token) return
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'users', uid)
    const snap = await transaction.get(ref)
    const tokens = snap.data()?.fcmTokens ?? {}
    transaction.set(ref, {
      notificationsEnabled: Object.keys(tokens).some((other) => other !== token),
      fcmTokens: { [token]: deleteField() },
    }, { merge: true })
  })
  localStorage.removeItem('salmos:fcmToken')
}

/** Push recebido com o app aberto: o SW não mostra nada, então tratamos aqui. */
export async function onForegroundPush(handler: (title: string, body: string) => void) {
  if (!(await isSupported())) return () => {}
  return onMessage(getMessaging(app), (payload) => {
    handler(
      payload.data?.title ?? payload.notification?.title ?? 'Projeto Salmos',
      payload.data?.body ?? payload.notification?.body ?? 'Seu salmo de hoje está esperando.',
    )
  })
}
