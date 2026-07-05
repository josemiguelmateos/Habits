const R = 52
const C = 2 * Math.PI * R

interface Props {
  waterMl: number
  goal: number
  done: boolean
  amounts: [number, number]
  onAdd: (ml: number) => void
  onReset: () => void
  disabled?: boolean
}

/** Anillo de hidratación de la home: usable con una mano desde el móvil. */
export function HydrationRing({ waterMl, goal, done, amounts, onAdd, onReset, disabled }: Props) {
  const p = goal > 0 ? Math.min(1, waterMl / goal) : 0

  return (
    <div className="card flex items-center gap-5 px-5 py-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60" cy="60" r={R}
            fill="none"
            strokeWidth="10"
            className="stroke-ink-raised"
          />
          <circle
            cx="60" cy="60" r={R}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - p)}
            className={`transition-[stroke-dashoffset] duration-500 ease-out ${
              done ? 'stroke-accent' : 'stroke-accent/70'
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {done ? (
            <>
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <p className="mt-0.5 font-display text-lg font-bold text-accent">
                {(waterMl / 1000).toFixed(waterMl % 1000 === 0 ? 0 : 1)} L
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold leading-none">
                {waterMl}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">de {goal} ml</p>
            </>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Hidratación
          </p>
          {waterMl > 0 && (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              aria-label="Poner agua a cero"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              ↺ reiniciar
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {amounts.map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(ml)}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-ink-raised font-display text-base font-bold text-zinc-100 transition-all hover:text-accent active:scale-[0.97] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {ml} ml
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
