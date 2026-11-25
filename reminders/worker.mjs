import { DELETE_FIELD, sendReminders } from './send-reminders.mjs'

const googleTokenUrl = 'https://oauth2.googleapis.com/token'
let access

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function googleToken(rawCredential) {
  if (access?.validUntil > Date.now()) return access.token
  const { client_email, private_key } = JSON.parse(rawCredential)
  const pem = private_key.replace(/-----[^-]+-----|\s/g, '')
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (byte) => byte.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)))
  const claims = encode({ iss: client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: googleTokenUrl, iat: now, exp: now + 3600 })
  const assertion = `${encode({ alg: 'RS256', typ: 'JWT' })}.${claims}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(assertion))
  const response = await fetch(googleTokenUrl, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${assertion}.${base64url(new Uint8Array(signature))}` }),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`Google OAuth HTTP ${response.status}`)
  const token = await response.json()
  access = { token: token.access_token, validUntil: Date.now() + (Number(token.expires_in) - 60) * 1000 }
  return access.token
}

function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [key, decode(child)]))
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode)
  return value.stringValue ?? value.booleanValue ?? value.doubleValue ??
    (value.integerValue == null ? null : Number(value.integerValue))
}

export function firebaseRest(projectId, token, request = fetch) {
  const documents = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  const fcm = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const call = (url, method = 'GET', body) => request(url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
  })

  return {
    async profiles() {
      const response = await call(`${documents}:runQuery`, 'POST', { structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: { fieldFilter: { field: { fieldPath: 'notificationsEnabled' }, op: 'EQUAL', value: { booleanValue: true } } },
        select: { fields: ['timezone', 'cycleStartDate', 'lastReadDate', 'lastReadDay', 'notificationTimes', 'sentToday', 'fcmTokens'].map((fieldPath) => ({ fieldPath })) },
      } })
      if (!response.ok) throw new Error(`Firestore query HTTP ${response.status}`)
      return (await response.json()).filter((row) => row.document).map(({ document }) => ({
        id: document.name.split('/').at(-1),
        data: () => Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)])),
        async update(patch) {
          const url = new URL(`https://firestore.googleapis.com/v1/${document.name}`)
          const fields = {}
          for (const [key, value] of Object.entries(patch)) {
            if (key.startsWith('fcmTokens.') && value === DELETE_FIELD) {
              const escaped = key.slice('fcmTokens.'.length).replace(/[`\\]/g, '\\$&')
              url.searchParams.append('updateMask.fieldPaths', 'fcmTokens.`' + escaped + '`')
            } else if (key === 'sentToday') {
              url.searchParams.append('updateMask.fieldPaths', key)
              fields.sentToday = { mapValue: { fields: {
                date: { stringValue: value.date },
                slots: { arrayValue: { values: value.slots.map((stringValue) => ({ stringValue })) } },
              } } }
            } else {
              throw new Error('Campo inesperado no registro do lembrete')
            }
          }
          const updated = await call(url, 'PATCH', { fields })
          if (!updated.ok) throw new Error(`Firestore update HTTP ${updated.status}`)
        },
      }))
    },
    async sendEachForMulticast({ tokens, data, notification, webpush }) {
      const responses = []
      for (const device of tokens) {
        try {
          const sent = await call(fcm, 'POST', { message: {
            token: device, data, notification,
            webpush: { headers: webpush.headers, notification: webpush.notification, fcm_options: webpush.fcmOptions },
          } })
          if (sent.ok) {
            responses.push({ success: true })
          } else {
            const { error } = await sent.json()
            const unregistered = error?.details?.some((detail) => detail.errorCode === 'UNREGISTERED')
            responses.push({ success: false, error: { code: unregistered ? 'messaging/registration-token-not-registered' : `FCM HTTP ${sent.status}` } })
          }
        } catch {
          responses.push({ success: false, error: { code: 'FCM sem resposta' } })
        }
      }
      return { responses, successCount: responses.filter((response) => response.success).length }
    },
  }
}

export default {
  async scheduled(_event, env) {
    const firebase = firebaseRest(env.FIREBASE_PROJECT_ID, await googleToken(env.FIREBASE_SERVICE_ACCOUNT))
    const { failed } = await sendReminders({ profiles: await firebase.profiles(), messaging: firebase, appUrl: env.APP_URL })
    if (failed) throw new Error(`${failed} lembrete(s) com falha de envio`)
  },
}
