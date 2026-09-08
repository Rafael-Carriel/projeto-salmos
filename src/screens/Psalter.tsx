import { Link } from 'react-router-dom'
import type { ProfileState } from '../hooks/useProfile'
import { TOTAL_PSALMS } from '../lib/cycle'

/**
 * Os 150 como índice do saltério: o que já foi lido está dourado, o de hoje
 * está contornado, o resto ainda não abriu. Ler adiante não é possível — é
 * o que dá peso ao dia.
 */
export function Psalter({ state }: { state: ProfileState }) {
  const { profile, cycle } = state
  if (!profile) return null

  const unlockedThrough = cycle.status === 'not-started' ? 0 : cycle.unlockedThrough
  const readThrough = cycle.status === 'not-started' ? 0 : profile.lastReadDay
  const justRead = Number(sessionStorage.getItem('salmos:justRead') ?? 0)
  const favorites = new Set(profile.favorites)

  return (
    <>
      <div className="section-head">
        <h1>Os cento e cinquenta</h1>
        <p>
          {unlockedThrough === 0
            ? 'Nenhum salmo aberto ainda. Comece o ciclo para liberar o Salmo 1.'
            : `Você abriu ${unlockedThrough} ${unlockedThrough === 1 ? 'salmo' : 'salmos'} neste ciclo e leu ${readThrough}. Os demais abrem um por dia.`}
        </p>
      </div>

      <ol className="psalter">
        {Array.from({ length: TOTAL_PSALMS }, (_, i) => i + 1).map((n) => {
          const unlocked = n <= unlockedThrough
          const read = n <= readThrough
          const isToday = cycle.status !== 'not-started' && n === cycle.unlockedThrough
          const classes = [
            'cell',
            read && 'cell--read',
            isToday && 'cell--today',
            !unlocked && 'cell--locked',
            favorites.has(n) && 'cell--fav',
            read && n === justRead && 'cell--just-read',
          ]
            .filter(Boolean)
            .join(' ')

          const label = `Salmo ${n}${read ? ', lido' : ''}${!unlocked ? ', ainda não aberto' : ''}${
            favorites.has(n) ? ', favorito' : ''
          }`

          return (
            <li key={n}>
              {unlocked ? (
                <Link to={`/salmo/${n}`} className={classes} aria-label={label}>
                  {n}
                </Link>
              ) : (
                <span className={classes} aria-label={label} aria-disabled="true">
                  {n}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="legend">
        <span>
          <i className="is-read" /> lido
        </span>
        <span>
          <i className="is-today" /> hoje
        </span>
        <span>
          <i /> aberto, não lido
        </span>
        <span>
          <i style={{ opacity: 0.45 }} /> ainda fechado
        </span>
      </div>
    </>
  )
}
