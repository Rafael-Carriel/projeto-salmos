/**
 * Lembretes do salmo do dia. Roda no GitHub Actions (veja
 * .github/workflows/reminders.yml) porque agendar no Firebase exigiria
 * Cloud Functions e o plano Blaze — o envio pelo FCM é gratuito no Spark.
 *
 * A cada execução, para cada pessoa com lembretes ligados:
 *   1. descobre a hora local dela pelo fuso salvo no perfil;
 *   2. dispara os horários que já passaram hoje e ainda não foram enviados;
 *   3. não incomoda quem já leu o salmo de hoje.
 *
 * Um horário nunca é antecipado: chega no horário escolhido ou pouco depois,
 * conforme o atraso do agendador do GitHub.
 *
 * Variáveis de ambiente:
 *   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço (secret do repositório)
 *   APP_URL                   endereço do site, para o clique na notificação
 *   DRY_RUN                   "1" para só listar o que seria enviado
 *                             (ou passe --dry-run na linha de comando)
 */
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

const TOTAL_PSALMS = 150
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
const APP_URL = process.env.APP_URL ?? '/'

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) {
  console.error('Defina FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço.')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(raw)) })
const db = getFirestore()
const messaging = getMessaging()

/** Data e hora locais da pessoa, no fuso dela. */
function localNow(timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  const hour = parts.hour === '24' ? '00' : parts.hour
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
  }
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return /^\d{2}:\d{2}$/.test(String(hhmm)) && Number.isInteger(h) && Number.isInteger(m) &&
    h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null
}

function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/**
 * Mesma regra do app (src/lib/cycle.ts): o dia N do ciclo é o Salmo N, e um
 * dia inteiro sem leitura zera a contagem.
 */
function pendingPsalm(profile, today) {
  if (!profile.cycleStartDate) return null
  const expected = Math.max(1, daysBetween(profile.cycleStartDate, today) + 1)
  const lastReadDay = profile.lastReadDay ?? 0
  if (lastReadDay >= TOTAL_PSALMS) return null
  if (profile.lastReadDate === today) return null // já leu hoje
  if (lastReadDay < expected - 1) return null // ciclo perdido, não é lembrete
  return expected
}

/** O tom muda conforme o dia avança: convite, retomada, última chance. */
function compose(psalm, minutesNow) {
  const hoursLeft = Math.floor((24 * 60 - minutesNow) / 60)
  if (minutesNow < 12 * 60) {
    return { title: `Salmo ${psalm}`, body: 'Seu salmo de hoje está aberto.' }
  }
  if (hoursLeft > 4) {
    return { title: `Salmo ${psalm}`, body: 'Ainda não lido hoje. Leva poucos minutos.' }
  }
  return {
    title: `Salmo ${psalm} — última chance`,
    body: `Faltam ${hoursLeft}h para a meia-noite. Sem leitura, o ciclo volta ao Salmo 1.`,
  }
}

const snapshot = await db.collection('users').where('notificationsEnabled', '==', true).get()
let sent = 0
let skipped = 0
let failed = 0

for (const document of snapshot.docs) {
  const profile = document.data()
  const tokens = Object.keys(profile.fcmTokens ?? {})
  if (tokens.length === 0) {
    skipped++
    continue
  }

  let local
  try {
    local = localNow(profile.timezone || 'America/Sao_Paulo')
  } catch {
    console.error('Perfil ignorado: fuso horário inválido.')
    skipped++
    continue
  }
  const { date, minutes } = local
  const psalm = pendingPsalm(profile, date)
  if (!psalm) {
    skipped++
    continue
  }

  // Zera o controle quando o dia local vira.
  const alreadySent = profile.sentToday?.date === date ? (profile.sentToday.slots ?? []) : []

  const due = (profile.notificationTimes ?? [])
    .filter((time) => {
      const at = toMinutes(time)
      return at !== null && minutes >= at && !alreadySent.includes(time)
    })
    .sort()

  if (due.length === 0) {
    skipped++
    continue
  }

  // Vários horários vencidos de uma vez (celular desligado, atraso do cron)
  // rendem um aviso só — o mais recente.
  const slot = due[due.length - 1]
  const { title, body } = compose(psalm, minutes)

  console.log(
    `${profile.email ?? document.id}: horário ${slot}, Salmo ${psalm}, ${tokens.length} aparelho(s)`,
  )
  if (DRY_RUN) {
    sent++
    continue
  }

  // Mensagem só com `data`: quem exibe é o nosso service worker, então o
  // texto e o clique ficam sob nosso controle nas duas plataformas.
  const response = await messaging.sendEachForMulticast({
    tokens,
    data: { title, body, url: APP_URL, psalm: String(psalm) },
    webpush: {
      headers: { Urgency: 'normal', TTL: '10800' },
      fcmOptions: { link: APP_URL },
    },
  })

  const dead = {}
  response.responses.forEach((result, i) => {
    const code = result.error?.code
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      dead[`fcmTokens.${tokens[i]}`] = FieldValue.delete()
    } else if (result.error) {
      console.error(`  token ${i}: ${code ?? result.error.message}`)
    }
  })

  // Failed deliveries must remain eligible for the next scheduler attempt.
  const patch = { ...dead }
  if (response.successCount > 0) patch.sentToday = { date, slots: [...alreadySent, ...due] }
  if (Object.keys(patch).length) await document.ref.update(patch)

  if (response.successCount > 0) sent++
  else failed++
  if (Object.keys(dead).length) {
    console.log(`  ${Object.keys(dead).length} token(s) expirado(s) removido(s)`)
  }
}

console.log(
  `${DRY_RUN ? '[simulação] ' : ''}${sent} lembrete(s) enviado(s), ${skipped} pessoa(s) sem nada pendente, ${failed} falha(s).`,
)
if (failed) process.exitCode = 1
