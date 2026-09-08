import type { Psalm } from '../lib/cycle'
import { AudioPlayer } from './AudioPlayer'
import { IconStar } from './icons'

/**
 * A página do salmo: pergaminho, versal iluminada no primeiro versículo
 * e os números pendurados na margem, como num saltério.
 */
export function PsalmLeaf({
  psalm,
  dayLabel,
  audioUrl,
  isFavorite,
  onToggleFavorite,
}: {
  psalm: Psalm
  dayLabel?: string
  audioUrl?: string
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  return (
    <article className="leaf">
      <header className="leaf__head">
        <h1 className="leaf__title">Salmo {psalm.number}</h1>
        <button
          className="star"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite
              ? `Remover o Salmo ${psalm.number} dos favoritos`
              : `Guardar o Salmo ${psalm.number} nos favoritos`
          }
        >
          <IconStar size={21} filled={isFavorite} />
        </button>
        {dayLabel && <span className="leaf__meta">{dayLabel}</span>}
      </header>

      <ol className="verses">
        {psalm.verses.map((verse, i) => (
          <li key={verse.number} className={`verse${i === 0 ? ' verse--first' : ''}`}>
            <span className="verse__n" aria-hidden="true">
              {verse.number}
            </span>
            <span className="verse__text">{verse.text}</span>
          </li>
        ))}
      </ol>

      <AudioPlayer src={audioUrl} label={`Salmo ${psalm.number}`} />
    </article>
  )
}
