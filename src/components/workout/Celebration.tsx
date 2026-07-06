import { Link } from 'react-router-dom'
import { formatKg } from '../../lib/stats'
import type { PrEvent } from './PrToast'

interface Props {
  seriesHechas: number
  ejercicios: number
  points: number
  habitsDone: number
  perfect: boolean
  volumenKg?: number
  prs?: PrEvent[]
}

export function Celebration({
  seriesHechas,
  ejercicios,
  points,
  habitsDone,
  perfect,
  volumenKg = 0,
  prs = [],
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-8 text-center">
      {/* halo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-72 w-72 animate-halo rounded-full bg-accent/10 blur-3xl" />
      </div>

      <svg viewBox="0 0 96 96" className="h-24 w-24">
        <circle
          cx="48" cy="48" r="42"
          fill="none" stroke="currentColor" strokeWidth="4"
          className="animate-draw-circle text-accent"
          strokeLinecap="round"
          strokeDasharray="264"
        />
        <path
          d="M32 50 l11 11 l21 -24"
          fill="none" stroke="currentColor" strokeWidth="6"
          strokeLinecap="round" strokeLinejoin="round"
          className="animate-draw-check text-accent"
          strokeDasharray="52"
        />
      </svg>

      <h1 className="mt-6 animate-fade-up font-display text-3xl font-bold tracking-tight">
        Entrenamiento completado
      </h1>
      <p className="mt-2 animate-fade-up text-sm text-zinc-500 [animation-delay:120ms]">
        {seriesHechas} series · {ejercicios} ejercicios
        {volumenKg > 0 && (
          <>
            {' · '}
            <span className="font-semibold text-zinc-300">
              {formatKg(volumenKg)} movidos
            </span>
          </>
        )}
      </p>

      {prs.length > 0 && (
        <div className="mt-4 flex animate-fade-up flex-col gap-1.5 [animation-delay:180ms]">
          {prs.map((pr) => (
            <p
              key={`${pr.nombre}${pr.peso}`}
              className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent"
            >
              PR · {pr.nombre} · {pr.peso} kg (+{pr.delta})
            </p>
          ))}
        </div>
      )}

      <div className="mt-8 flex animate-fade-up items-end gap-8 [animation-delay:240ms]">
        <div>
          <p className="font-display text-5xl font-bold text-accent">{points}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
            puntos hoy
          </p>
        </div>
        <div>
          <p className="font-display text-5xl font-bold">{habitsDone}<span className="text-2xl text-zinc-500">/4</span></p>
          <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">hábitos</p>
        </div>
      </div>
      {perfect && (
        <p className="mt-4 animate-fade-up rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent [animation-delay:320ms]">
          Día perfecto · +1 bonus
        </p>
      )}

      <Link
        to="/"
        className="mt-10 inline-flex min-h-12 animate-fade-up items-center rounded-xl bg-accent px-8 font-semibold text-accent-ink transition-transform [animation-delay:400ms] active:scale-95"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
