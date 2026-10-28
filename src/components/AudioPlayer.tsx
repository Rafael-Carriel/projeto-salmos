import { useEffect, useRef, useState } from 'react'
import { IconPause, IconPlay } from './icons'

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Player enxuto para a narração do salmo. Fica dentro da página de pergaminho,
 * então não usa os controles nativos do navegador — eles quebram a página.
 * Sem `src`, aparece desativado com a explicação.
 */
export function AudioPlayer({ src, label }: { src?: string; label: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setDuration(0)
    setFailed(false)
  }, [src])

  if (!src) {
    return (
      <div className="audio">
        <button className="audio__play" disabled aria-label="Áudio indisponível">
          <IconPlay />
        </button>
        <span>Narração ainda não disponível para este salmo.</span>
      </div>
    )
  }

  const progress = duration > 0 ? (time / duration) * 100 : 0

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = ref.current
    if (!audio || !duration) return
    const box = event.currentTarget.getBoundingClientRect()
    audio.currentTime = ((event.clientX - box.left) / box.width) * duration
  }

  async function toggle() {
    const audio = ref.current
    if (!audio) return
    if (failed && src) {
      const fresh = new URL(src, window.location.origin)
      fresh.searchParams.set('retry', String(Date.now()))
      setFailed(false)
      audio.src = fresh.href
      audio.load()
    }
    if (audio.paused) {
      try {
        await audio.play()
      } catch (error) {
        // Changing salmos can interrupt a pending play request normally.
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
      }
    } else {
      audio.pause()
    }
  }

  return (
    <div className="audio">
      <audio
        key={src}
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <button
        className="audio__play"
        onClick={toggle}
        aria-label={failed ? `Tentar ouvir ${label} novamente` : playing ? `Pausar ${label}` : `Ouvir ${label}`}
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      {failed ? (
        <span>Não consegui carregar o áudio. Toque no botão para tentar novamente.</span>
      ) : (
        <>
          <div
            className="audio__track"
            onClick={seek}
            role="progressbar"
            aria-label="Posição da narração"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
          >
            <div className="audio__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="audio__time">
            {clock(time)} / {clock(duration)}
          </span>
        </>
      )}
    </div>
  )
}
