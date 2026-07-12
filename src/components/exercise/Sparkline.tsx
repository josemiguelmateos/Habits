import { sparklinePath } from '../../lib/sparkline'

const ACCENT = '#a3e635'

interface Props {
  values: number[]
  width?: number
  height?: number
  className?: string
}

/** Sparkline SVG puro (sin Recharts). Devuelve null con menos de 2 puntos. */
export function Sparkline({ values, width = 56, height = 20, className }: Props) {
  const d = sparklinePath(values, width, height)
  if (!d) return null

  const pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const last = values[values.length - 1]
  const cx = width - pad
  const h = height - pad * 2
  const cy = max === min ? pad + h / 2 : pad + h - ((last - min) / (max - min)) * h

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={1.8} fill={ACCENT} />
    </svg>
  )
}
