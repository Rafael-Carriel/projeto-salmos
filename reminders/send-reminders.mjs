const TOTAL_PSALMS = 150
export const DELETE_FIELD = Symbol('delete reminder field')

/** Data e hora locais da pessoa, no fuso dela. */
function localNow(timezone, now) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
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

export async function sendReminders({ profiles, messaging, appUrl, dryRun = false, now = new Date() }) {
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const document of profiles) {
    const profile = document.data()
    const tokens = Object.keys(profile.fcmTokens ?? {})
    if (tokens.length === 0) {
      skipped++
      continue
    }

    let local
    try {
      local = localNow(profile.timezone || 'America/Sao_Paulo', now)
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
      `${document.id}: horário ${slot}, Salmo ${psalm}, ${tokens.length} aparelho(s)`,
    )
    if (dryRun) {
      sent++
      continue
    }

    // O Firebase exibe a notificação quando a página está fechada ou em segundo plano.
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { title, body, url: appUrl, psalm: String(psalm), reminderDate: date, reminderSlot: slot },
      webpush: {
        headers: { Urgency: 'high', TTL: '10800' },
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'salmo-do-dia', renotify: true },
        fcmOptions: { link: appUrl },
      },
    })

    const dead = {}
    response.responses.forEach((result, i) => {
      const code = result.error?.code
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        dead[`fcmTokens.${tokens[i]}`] = DELETE_FIELD
      } else if (result.error) {
        console.error(`  token ${i}: ${code ?? result.error.message}`)
      }
    })

    // Failed deliveries must remain eligible for the next scheduler attempt.
    const patch = { ...dead }
    if (response.successCount > 0) patch.sentToday = { date, slots: [...alreadySent, ...due] }
    if (Object.keys(patch).length) await document.update(patch)

    if (response.successCount > 0) sent++
    else failed++
    if (Object.keys(dead).length) {
      console.log(`  ${Object.keys(dead).length} token(s) expirado(s) removido(s)`)
    }
  }

  console.log(
    `${dryRun ? '[simulação] ' : ''}${sent} lembrete(s) enviado(s), ${skipped} pessoa(s) sem nada pendente, ${failed} falha(s).`,
  )

  return { sent, skipped, failed }
}
