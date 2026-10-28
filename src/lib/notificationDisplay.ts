import { pushTimeout } from './pushTimeout'

/** Some browsers update permission without resolving requestPermission's promise. */
export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission)
  return new Promise((resolve, reject) => {
    let poll: ReturnType<typeof setInterval> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (permission: NotificationPermission) => {
      clearInterval(poll)
      clearTimeout(timer)
      resolve(permission)
    }
    poll = setInterval(() => {
      if (Notification.permission !== 'default') finish(Notification.permission)
    }, 200)
    timer = setTimeout(() => {
      clearInterval(poll)
      if (Notification.permission !== 'default') finish(Notification.permission)
      else reject(new Error('O pedido de permissão continua pendente no navegador.'))
    }, 15000)
    try {
      // Keep this call synchronous with the user's click.
      const request = Notification.requestPermission(finish)
      request?.then(finish, (error) => { clearInterval(poll); clearTimeout(timer); reject(error) })
    } catch (error) {
      clearInterval(poll)
      clearTimeout(timer)
      reject(error)
    }
  })
}

export async function displayNotification(title: string, body: string): Promise<void> {
  // Desktop browsers support direct notifications. Wait for the actual show
  // event instead of treating a fulfilled worker request as visible delivery.
  if (!/Android|iPad|iPhone|iPod/.test(navigator.userAgent)) {
    let notification: Notification | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        notification = new Notification(title, {
          body, icon: '/icons/icon-192.png', tag: 'salmos-teste', requireInteraction: true,
        })
        const timer = setTimeout(() => {
          notification?.close()
          reject(new Error('O navegador recebeu o pedido, mas não confirmou a exibição da notificação.'))
        }, 10000)
        notification.onshow = () => { clearTimeout(timer); resolve() }
        notification.onerror = () => {
          clearTimeout(timer)
          reject(new Error('O navegador informou uma falha ao exibir a notificação.'))
        }
        notification.onclick = () => { window.focus(); notification?.close() }
      })
      return
    } catch (error) {
      // Mobile-style implementations can expose Notification but reject its
      // constructor. Those must use the service-worker API instead.
      if (!(error instanceof TypeError)) throw error
    }
  }
  const registration = await pushTimeout(
    navigator.serviceWorker.register('/notification-test-sw.js', { scope: '/notification-test/' }),
    'O navegador não concluiu a preparação da notificação.',
  )
  const worker = registration.installing ?? registration.waiting ?? registration.active
  if (!worker) throw new Error('Não foi possível iniciar a exibição de notificações.')
  if (worker.state !== 'activated') {
    await pushTimeout(new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (worker.state === 'activated' || worker.state === 'redundant') {
          worker.removeEventListener('statechange', changed)
          if (worker.state === 'activated') resolve()
          else reject(new Error('Falha ao preparar a notificação.'))
        }
      }
      worker.addEventListener('statechange', changed)
      changed()
    }), 'O navegador não ativou a exibição da notificação.')
  }
  await pushTimeout(registration.showNotification(title, {
    body, icon: '/icons/icon-192.png', tag: 'salmos-teste', requireInteraction: true, data: { url: '/' },
  }), 'O navegador não concluiu a exibição da notificação.')
}
