import { Link } from 'react-router-dom'
import type { ProfileState } from '../hooks/useProfile'
import { getPsalm, preview } from '../lib/psalms'

export function Favorites({ state }: { state: ProfileState }) {
  const { profile, cycle } = state
  if (!profile) return null

  const unlockedThrough = cycle.status === 'not-started' ? 0 : cycle.unlockedThrough

  if (profile.favorites.length === 0) {
    return (
      <>
        <div className="section-head">
          <h1>Salmos guardados</h1>
        </div>
        <p className="empty">
          Nada guardado ainda. Ao ler, toque na estrela no alto da página para trazer o salmo para
          cá.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="section-head">
        <h1>Salmos guardados</h1>
        <p>
          {profile.favorites.length}{' '}
          {profile.favorites.length === 1 ? 'salmo guardado' : 'salmos guardados'}. Ficam aqui
          mesmo depois que o ciclo recomeça.
        </p>
      </div>

      <ul className="rows">
        {profile.favorites.map((n) => {
          const psalm = getPsalm(n)
          if (!psalm) return null
          const unlocked = n <= unlockedThrough
          // Um saltério se indexa pelas palavras de abertura, não por um
          // rótulo genérico: o número em ouro identifica, o texto lembra.
          const body = (
            <>
              <span className="row__n" aria-hidden="true">
                {n}
              </span>
              <span className="row__body">
                <span className="visually-hidden">Salmo {n}. </span>
                {unlocked ? (
                  <span className="row__incipit">{preview(psalm, 110)}</span>
                ) : (
                  <span className="row__closed">Abre no dia {n} do ciclo.</span>
                )}
              </span>
            </>
          )
          return (
            <li key={n}>
              {unlocked ? (
                <Link className="row" to={`/salmo/${n}`}>
                  {body}
                </Link>
              ) : (
                <div className="row row--closed">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
