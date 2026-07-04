import { useState } from 'react'
import type { Exercise } from '../../types'
import { parseYouTubeUrl } from '../../lib/youtube'
import { YouTubeFacade } from './YouTubeFacade'
import { ExercisePhoto } from './ExercisePhoto'

interface Props {
  exercise: Exercise
  /** series×reps para la tarjeta placeholder */
  seriesReps?: string
  onAddMedia?: () => void
}

/**
 * Prioridad de visualización: vídeo → foto → placeholder tipográfico.
 * Si hay ambos, el vídeo manda y la foto queda tras un toggle (útil sin cobertura).
 */
export function ExerciseMedia({ exercise, seriesReps, onAddMedia }: Props) {
  const [showPhoto, setShowPhoto] = useState(false)
  const parsed = exercise.video_url ? parseYouTubeUrl(exercise.video_url) : null
  const hasPhoto = Boolean(exercise.photo_url)

  if (parsed && (!showPhoto || !hasPhoto)) {
    return (
      <div>
        <YouTubeFacade videoId={parsed.id} start={parsed.start} title={exercise.nombre} />
        {hasPhoto && (
          <button
            type="button"
            onClick={() => setShowPhoto(true)}
            className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Ver foto
          </button>
        )}
      </div>
    )
  }

  if (hasPhoto) {
    return (
      <div>
        <ExercisePhoto path={exercise.photo_url!} alt={exercise.nombre} />
        {parsed && (
          <button
            type="button"
            onClick={() => setShowPhoto(false)}
            className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Ver vídeo
          </button>
        )}
      </div>
    )
  }

  // Placeholder tipográfico intencionado, no "algo roto"
  return (
    <div className="flex aspect-video w-full flex-col items-start justify-between rounded-xl border border-dashed border-ink-border bg-ink-soft p-4">
      <div>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {exercise.grupo_muscular ?? 'Ejercicio'}
        </p>
        <p className="mt-1 font-display text-lg font-semibold leading-tight text-zinc-200">
          {exercise.nombre}
        </p>
        {seriesReps && (
          <p className="mt-1 font-display text-sm text-zinc-500">{seriesReps}</p>
        )}
      </div>
      {onAddMedia && (
        <button
          type="button"
          onClick={onAddMedia}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Añadir vídeo o foto
        </button>
      )}
    </div>
  )
}
