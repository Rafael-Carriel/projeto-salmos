import { deleteField, doc, runTransaction, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { app, db } from './firebase'
import { pushTimeout } from './pushTimeout'
import { displayNotification, requestNotificationPermission } from './notificationDisplay'

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
  if (pushStatus() === 'unsupported') throw new Error('Este navegador não possui a função de notificações.')
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') throw new Error('O navegador não concedeu permissão para exibir a notificação.')
  await displayNotification('Teste — Projeto Salmos', 'Esta é a notificação de teste que você solicitou.')
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
export async function enablePush(uid: string, progress: (message: string) => void = () => {}): Promise<PushStatus> {
  if (pushStatus() === 'unsupported') return 'unsupported'
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY não definida — push desativado.')
    return 'unsupported'
  }

  // Request before any await so browsers retain the button's user gesture.
  progress('Aguardando a permissão de notificações do navegador…')
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return permission as PushStatus
  progress('Verificando o suporte a lembretes deste navegador…')
  if (!(await pushTimeout(isSupported(), 'O navegador não concluiu a verificação de notificações. Use o Chrome ou Edge.'))) return 'unsupported'

  // public/ não passa pelo Vite, então a config vai na query string.
  // São valores públicos do projeto — nada sigiloso trafega aqui.
  const config = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  progress('Preparando as notificações neste aparelho…')
  const registration = await pushTimeout(navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${config}`,
    { scope: '/firebase-cloud-messaging-push-scope' },
  ), 'Não foi possível preparar as notificações. Confira a conexão e tente novamente.')
  progress('Conectando este aparelho ao serviço de lembretes…')
  const token = await pushTimeout(getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }), 'Este navegador não concluiu o cadastro de notificações. Abra o site no Chrome ou Edge e tente novamente.', 25000)
  if (!token) return 'denied'

  progress('Salvando a ativação dos lembretes…')
  await pushTimeout(setDoc(
    doc(db, 'users', uid),
    {
      notificationsEnabled: true,
      fcmTokens: { [token]: Date.now() },
    },
    { merge: true },
  ), 'A ativação ainda não foi confirmada. Confira a conexão e tente novamente.')
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
    const title = payload.data?.title ?? payload.notification?.title ?? 'Projeto Salmos'
    const body = payload.data?.body ?? payload.notification?.body ?? 'Seu salmo de hoje está esperando.'
    handler(title, body)
    if (pushStatus() === 'granted') {
      void displayNotification(title, body).catch((error) => console.error('Falha ao exibir notificação:', error))
    }
  })
}
