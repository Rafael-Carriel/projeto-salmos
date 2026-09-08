import { Link, useParams } from 'react-router-dom'
import { PsalmLeaf } from '../components/PsalmLeaf'
import { useAudioUrls } from '../hooks/useAudioUrls'
import { useIsAdmin } from '../hooks/useIsAdmin'
import type { ProfileState } from '../hooks/useProfile'
import { TOTAL_PSALMS } from '../lib/cycle'
import { getPsalm } from '../lib/psalms'

/** Releitura de um salmo já aberto neste ciclo. */
export function PsalmView({ state }: { state: ProfileState }) {
  const { number } = useParams()
  const { profile, cycle, toggleFavorite } = state
  const audioUrls = useAudioUrls()
  const isAdmin = useIsAdmin()

  const n = Number(number)
  const psalm = Number.isInteger(n) ? getPsalm(n) : undefined

  if (!profile || !psalm) {
    return (
      <p className="empty">
        Salmo não encontrado. <Link to="/salterio">Volte para os cento e cinquenta.</Link>
      </p>
    )
  }

  const unlockedThrough = cycle.status === 'not-started' ? 0 : cycle.unlockedThrough
  if (n > unlockedThrough && !isAdmin) {
    return (
      <p className="empty">
        O Salmo {n} ainda não abriu. Ele chega no dia {n} do seu ciclo.{' '}
        <Link to="/">Ver o salmo de hoje.</Link>
      </p>
    )
  }

  const read = n <= profile.lastReadDay

  return (
    <>
      <p className="banner">
        Releitura do dia {n} de {TOTAL_PSALMS}
        {read ? ', já marcado como lido' : ''}. <Link to="/">Ir para o salmo de hoje.</Link>
      </p>

      <PsalmLeaf
        psalm={psalm}
        dayLabel={`dia ${n} de ${TOTAL_PSALMS}`}
        audioUrl={audioUrls[String(psalm.number)]}
        isFavorite={profile.favorites.includes(psalm.number)}
        onToggleFavorite={() => void toggleFavorite(psalm.number)}
      />
    </>
  )
}
