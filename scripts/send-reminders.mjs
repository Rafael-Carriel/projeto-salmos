import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { DELETE_FIELD, sendReminders } from '../reminders/send-reminders.mjs'

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) {
  console.error('Defina FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço.')
  process.exit(1)
}

const app = initializeApp({ credential: cert(JSON.parse(raw)) })
const snapshot = await getFirestore(app).collection('users').where('notificationsEnabled', '==', true).get()
const { failed } = await sendReminders({
  profiles: snapshot.docs.map((doc) => ({
    id: doc.id,
    data: () => doc.data(),
    update: (patch) => doc.ref.update(Object.fromEntries(Object.entries(patch).map(([key, value]) => [
      key, value === DELETE_FIELD ? FieldValue.delete() : value,
    ]))),
  })),
  messaging: getMessaging(app),
  appUrl: process.env.APP_URL || 'https://projeto-salmos.web.app',
  dryRun: process.env.DRY_RUN === '1' || process.argv.includes('--dry-run'),
})
if (failed) process.exitCode = 1
