import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheck } from '../components/icons'
import { PsalmLeaf } from '../components/PsalmLeaf'
import { useAudioUrls } from '../hooks/useAudioUrls'
import type { ProfileState } from '../hooks/useProfile'
import { TOTAL_PSALMS, addDays, msUntilMidnight, todayKey } from '../lib/cycle'
import { getPsalm } from '../lib/psalms'

/** Quanto falta para a virada do dia, atualizado a cada minuto. */
function useMidnightCountdown(): { label: string; urgent: boolean } {
  const [ms, setMs] = useState(msUntilMidnight)
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilMidnight()), 30_000)
    return () => clearInterval(id)
  }, [])
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return {
    label: hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`,
    urgent: totalMinutes <= 120,
  }
}

/**
 * O primeiro versículo de um salmo como epígrafe. Nas telas de limiar — antes
 * de começar, depois de perder o ciclo, ao fechar os cento e cinquenta — é o
 * texto que dá peso à página, no lugar de um campo vazio de azul.
 */
function Epigraph({ psalm, note }: { psalm: number; note: string }) {
  const raw = getPsalm(psalm)?.verses[0]?.text
  if (!raw) return null
  // Muitos versículos terminam em vírgula ou ponto-e-vírgula porque a frase
  // segue no versículo seguinte. Fechar com reticências é mais honesto.
  const text = raw.replace(/[;,]\s*$/, '…')
  return (
    <blockquote className="epigraph">
      <p className="epigraph__line">“{text}”</p>
      <cite className="epigraph__cite">
        Salmo {psalm}.1 — {note}
      </cite>
    </blockquote>
  )
}

export function Today({ state }: { state: ProfileState }) {
  const { profile, cycle, startCycle, markRead, toggleFavorite } = state
  const audioUrls = useAudioUrls()
  const countdown = useMidnightCountdown()
  const [busy, setBusy] = useState(false)

  if (!profile) return <p className="spinner">Abrindo o saltério…</p>

  if (cycle.status === 'not-started') {
    const reached = profile.lastReadDay
    return (
      <section className="threshold">
        {reached > 0 ? (
          <>
            <h1>O ciclo voltou ao Salmo 1.</h1>
            <p>
              Você chegou ao dia {reached}. Um dia inteiro sem leitura recomeça a contagem — é a
              regra que faz o hábito valer. Seu recorde de {profile.bestDay} dias fica guardado.
            </p>
          </>
        ) : (
          <>
            <h1>Cento e cinquenta salmos, um por dia.</h1>
            <p>
              Hoje é o Salmo 1. Amanhã, o 2, e assim até o 150. Se um dia passar sem leitura, a
              contagem volta ao começo.
            </p>
          </>
        )}

        <Epigraph psalm={1} note={reached > 0 ? 'onde você recomeça' : 'onde você começa'} />

        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void startCycle().finally(() => setBusy(false))
          }}
        >
          {reached > 0 ? 'Recomeçar do Salmo 1' : 'Começar hoje'}
        </button>
      </section>
    )
  }

  if (cycle.status === 'cycle-complete') {
    return (
      <section className="threshold">
        <h1>Cento e cinquenta.</h1>
        <p>
          Você leu o saltério inteiro, do 1 ao 150, sem perder um dia. Este é seu{' '}
          {profile.completedCycles}º ciclo completo. Os favoritos continuam em{' '}
          <Link to="/favoritos">seus salmos guardados</Link>.
        </p>

        <Epigraph psalm={150} note="o último dos cento e cinquenta" />

        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void startCycle().finally(() => setBusy(false))
          }}
        >
          Começar um novo ciclo
        </button>
      </section>
    )
  }

  const psalm = getPsalm(cycle.day)
  if (!psalm) {
    return (
      <p className="empty">
        O texto do Salmo {cycle.day} não está no aplicativo. Rode{' '}
        <code>node scripts/fetch-psalms.mjs</code> e publique de novo.
      </p>
    )
  }

  const done = cycle.status === 'done-today'
  const tomorrow = cycle.day + 1

  return (
    <>
      {done && (
        <p className="banner">
          <IconCheck />
          <span>
            Lido hoje.{' '}
            {tomorrow <= TOTAL_PSALMS
              ? `O Salmo ${tomorrow} abre amanhã.`
              : 'Amanhã você fecha o saltério.'}{' '}
            Pode reler quantas vezes quiser.
          </span>
        </p>
      )}

      <PsalmLeaf
        psalm={psalm}
        dayLabel={`dia ${cycle.day} de ${TOTAL_PSALMS}`}
        audioUrl={audioUrls[String(psalm.number)]}
        isFavorite={profile.favorites.includes(psalm.number)}
        onToggleFavorite={() => void toggleFavorite(psalm.number)}
      />

      {!done && (
        <div className="after-leaf">
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void markRead(cycle.day)
                .then(() => sessionStorage.setItem('salmos:justRead', String(cycle.day)))
                .finally(() => setBusy(false))
            }}
          >
            Marquei como lido
          </button>
          <p className={`stakes${countdown.urgent ? ' stakes--urgent' : ''}`}>
            Se a meia-noite passar sem leitura, o ciclo volta ao Salmo 1. Faltam{' '}
            <b>{countdown.label}</b>.
          </p>
        </div>
      )}

      {done && profile.lastReadDate === todayKey() && (
        <p className="stakes" style={{ marginTop: '1.5rem' }}>
          Próxima leitura a partir de {addDays(profile.lastReadDate, 1).split('-').reverse().join('/')}.
        </p>
      )}
    </>
  )
}
