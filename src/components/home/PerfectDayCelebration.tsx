import { useEffect } from 'react'

// Piezas de confeti deterministas (posición X, retardo y color por pieza).
const COLORES = ['#a3e635', '#f4f4f5', '#84cc16', '#bef264']
const PIEZAS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 6.3 + (i % 3) * 4) % 100}%`,
  delay: `${(i % 5) * 0.15}s`,
  color: COLORES[i % COLORES.length],
}))

interface Props {
  puntos: number
  onClose: () => void
}

export function PerfectDayCelebration({ puntos, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-8 backdrop-blur-sm"
    >
      {/* Confeti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PIEZAS.map((p, i) => (
          <span
            key={i}
            className="animate-confeti absolute top-0 h-2.5 w-1.5 rounded-[1px]"
            style={{ left: p.left, animationDelay: p.delay, backgroundColor: p.color }}
          />
        ))}
      </div>

      {/* Tarjeta */}
      <div className="animate-fade-up relative flex flex-col items-center text-center">
        <svg viewBox="0 0 96 96" className="h-20 w-20">
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
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          ¡Día perfecto!
        </h1>
        <p className="mt-1 text-sm text-zinc-400">4/4 pilares</p>
        <p className="mt-4 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
          +{puntos} puntos hoy
        </p>
      </div>
    </div>
  )
}
