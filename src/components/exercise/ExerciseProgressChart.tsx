import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildProgressSeries, marcarPRs } from '../../lib/progress'
import type { SetLike, PesoFecha } from '../../lib/stats'

const ACCENT = '#a3e635'
const GRID = '#2a2a32'
const MUTED = '#71717a'

const tooltipStyle = {
  backgroundColor: '#17171b',
  border: `1px solid ${GRID}`,
  borderRadius: 12,
  fontSize: 12,
  color: '#f4f4f5',
} as const

type Metrica = 'oneRM' | 'pesoMax' | 'volumen'

const METRICAS: { key: Metrica; label: string; unidad: string }[] = [
  { key: 'oneRM', label: '1RM', unidad: 'kg' },
  { key: 'pesoMax', label: 'Peso máx', unidad: 'kg' },
  { key: 'volumen', label: 'Volumen', unidad: 'kg' },
]

interface ChartRow {
  dia: string
  fecha: string
  valor: number
  isPR: boolean
  mejorSet: { peso: number; reps: number } | null
}

interface Props {
  setLogs: SetLike[]
  dayLogs: PesoFecha[]
}

function formatoFecha(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

export default function ExerciseProgressChart({ setLogs, dayLogs }: Props) {
  const [metrica, setMetrica] = useState<Metrica>('oneRM')

  const serie = useMemo(() => buildProgressSeries(setLogs, dayLogs), [setLogs, dayLogs])

  const { data, unidad } = useMemo(() => {
    const conPR = marcarPRs(serie, metrica)
    const info = METRICAS.find((m) => m.key === metrica)!
    const rows: ChartRow[] = conPR
      .filter((p) => p[metrica] != null)
      .map((p) => ({
        dia: p.fecha.slice(5),
        fecha: p.fecha,
        valor: p[metrica] as number,
        isPR: p.isPR,
        mejorSet: p.mejorSet,
      }))
    return { data: rows, unidad: info.unidad }
  }, [serie, metrica])

  // Sin ninguna sesión registrada
  if (serie.length === 0) {
    return (
      <div className="rounded-xl border border-ink-border bg-ink-card px-4 py-6 text-center">
        <p className="text-sm leading-relaxed text-zinc-500">
          Registra series en el modo entrenamiento y aquí verás tu progresión.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Progresión
        </p>
        <div className="flex gap-1">
          {METRICAS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetrica(m.key)}
              aria-pressed={metrica === m.key}
              className={`rounded-lg px-2.5 py-1 font-display text-xs font-semibold transition-colors ${
                metrica === m.key
                  ? 'bg-accent text-accent-ink'
                  : 'bg-ink-raised text-zinc-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          El 1RM y el volumen necesitan las reps del modo entrenamiento. Marca
          series ahí (o usa “Peso máx” si solo apuntaste kg en el calendario).
        </p>
      ) : (
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fill: MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
              />
              <YAxis
                tick={{ fill: MUTED, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit={unidad}
                width={44}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: GRID }}
                content={<ProgressTooltip unidad={unidad} />}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke={ACCENT}
                strokeWidth={2}
                dot={<ProgressDot />}
                activeDot={{ r: 5, fill: ACCENT, stroke: '#17171b', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: ChartRow
}

function ProgressDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null) return null
  if (payload?.isPR) {
    return <circle cx={cx} cy={cy} r={5} fill={ACCENT} stroke="#17171b" strokeWidth={2} />
  }
  return <circle cx={cx} cy={cy} r={3} fill={ACCENT} />
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: ChartRow }[]
  unidad: string
}

function ProgressTooltip({ active, payload, unidad }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="font-display text-sm font-semibold text-zinc-100">
        {row.valor} {unidad}
        {row.isPR && <span className="ml-2 font-sans text-xs font-bold text-accent">PR</span>}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        {formatoFecha(row.fecha)}
        {row.mejorSet && ` · ${row.mejorSet.reps} × ${row.mejorSet.peso} kg`}
      </p>
    </div>
  )
}
