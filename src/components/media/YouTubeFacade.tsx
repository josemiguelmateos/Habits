import { useState } from 'react'
import { buildEmbedUrl, thumbnailUrl } from '../../lib/youtube'

interface Props {
  videoId: string
  start?: number
  title?: string
}

/**
 * Patrón facade obligatorio: nada de iframes al renderizar listas (cada
 * iframe de YouTube pesa >1 MB de JS y en el gimnasio la conexión es mala).
 * Solo miniatura + play; el iframe se carga al tocar.
 */
export function YouTubeFacade({ videoId, start = 0, title }: Props) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          className="h-full w-full"
          src={buildEmbedUrl(videoId, start)}
          title={title ?? 'Vídeo de demostración'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-black"
      aria-label={`Reproducir ${title ?? 'vídeo'}`}
    >
      <img
        src={thumbnailUrl(videoId)}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition-transform group-active:scale-95">
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
      </span>
      {start > 0 && (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-display text-xs font-medium text-zinc-200">
          {Math.floor(start / 60)}:{String(start % 60).padStart(2, '0')}
        </span>
      )}
    </button>
  )
}
