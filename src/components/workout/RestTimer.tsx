import { useEffect, useState } from 'react'

interface Props {
  /** segundos totales; cambia `runKey` para reiniciar */
  seconds: number
  runKey: number
  onDismiss: () => void
}

/** Temporizador de descanso fijo abajo. Aviso visual (y vibración) al terminar. */
export function RestTimer({ seconds, runKey, onDismiss }: Props) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
    const started = Date.now()
    const id = setInterval(() => {
      const rest = seconds - Math.floor((Date.now() - started) / 1000)
      setLeft(rest)
      if (rest <= 0) {
        clearInterval(id)
        if ('vibrate' in navigator) navigator.vibrate([180, 90, 180])
      }
    }, 250)
    return () => clearInterval(id)
  }, [seconds, runKey])

  const done = left <= 0
  const pct = seconds > 0 ? Math.max(0, left / seconds) : 0
  const mm = Math.floor(Math.max(0, left) / 60)
  const ss = String(Math.max(0, left) % 60).padStart(2, '0')

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-colors ${
        done
          ? 'animate-pulse border-accent/60 bg-accent/15'
          : 'border-ink-border/60 bg-ink/90'
      }`}
    >
      <div className="mx-auto flex max-w-lg items-center gap-4">
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              done ? 'text-accent' : 'text-zinc-500'
            }`}
          >
            {done ? '¡A por la siguiente serie!' : 'Descanso'}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-raised">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                done ? 'bg-accent' : 'bg-accent/70'
              }`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
        <p
          className={`font-display text-3xl font-bold tabular-nums ${
            done ? 'text-accent' : 'text-zinc-100'
          }`}
        >
          {mm}:{ss}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            done
              ? 'bg-accent text-accent-ink'
              : 'bg-ink-raised text-zinc-300 hover:text-zinc-100'
          }`}
        >
          {done ? 'Listo' : 'Saltar'}
        </button>
      </div>
    </div>
  )
}
