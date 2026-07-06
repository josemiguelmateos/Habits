import { useEffect } from 'react'

export interface PrEvent {
  nombre: string
  peso: number
  delta: number
}

interface Props {
  pr: PrEvent
  onDone: () => void
}

/** Aviso de récord personal en pleno entrenamiento. Se cierra solo. */
export function PrToast({ pr, onDone }: Props) {
  useEffect(() => {
    if ('vibrate' in navigator) navigator.vibrate([120, 60, 120])
    const id = setTimeout(onDone, 4000)
    return () => clearTimeout(id)
  }, [pr, onDone])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-2xl border border-accent/60 bg-ink-card px-5 py-3.5 shadow-xl shadow-accent/10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
            <path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1" />
          </svg>
        </span>
        <div>
          <p className="font-display text-sm font-bold text-accent">
            ¡Récord personal!
          </p>
          <p className="text-sm text-zinc-300">
            {pr.nombre} · <span className="font-semibold text-zinc-100">{pr.peso} kg</span>{' '}
            <span className="text-accent">(+{pr.delta})</span>
          </p>
        </div>
      </div>
    </div>
  )
}
