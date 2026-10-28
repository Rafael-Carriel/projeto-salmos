/* global importScripts, firebase, clients */
/*
  Service worker do Firebase Cloud Messaging — mostra os lembretes quando o
  app está fechado ou em segundo plano.

  Este arquivo fica em public/ e não passa pelo Vite, então a configuração
  chega pela query string do registro (veja src/lib/push.ts). São dados
  públicos do projeto, não há segredo aqui.
*/
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js')

const params = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

const messaging = firebase.messaging()

// Só cai aqui em mensagens "data-only". As que trazem `notification`
// o navegador exibe sozinho, e tratar aqui duplicaria o aviso.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data ?? {}
  return self.registration.showNotification(data.title ?? 'Projeto Salmos', {
    body: data.body ?? 'Seu salmo de hoje está esperando.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'salmo-do-dia',
    renotify: true,
    data: { url: data.url ?? '/' },
  })
})

// Toque na notificação: reaproveita a aba aberta em vez de abrir outra.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin) && 'focus' in win) {
          win.navigate?.(target)
          return win.focus()
        }
      }
      return clients.openWindow(target)
    }),
  )
})
