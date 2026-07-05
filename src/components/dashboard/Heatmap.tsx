import type { DailyLog } from '../../types'
import { addDays } from '../../lib/streaks'
import { isoWeekday } from '../../lib/days'
import { dailyPoints } from '../../lib/score'

const NIVELES = [
  'bg-ink-raised',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
]

interface Props {
  byFecha: Map<string, DailyLog>
  today: string
  weeks?: number
}

/** Heatmap tipo GitHub: intensidad = hábitos cumplidos ese día (0-4). */
export function Heatmap({ byFecha, today, weeks = 18 }: Props) {
  // Lunes de la semana actual, y de ahí hacia atrás
  const mondayOfCurrent = addDays(today, -(isoWeekday(new Date(`${today}T12:00:00`)) - 1))
  const cols: string[][] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addDays(mondayOfCurrent, -7 * w)
    cols.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))
  }

  return (
    <div>
      <div className="flex justify-between gap-[3px]">
        {cols.map((col) => (
          <div key={col[0]} className="flex flex-1 flex-col gap-[3px]">
            {col.map((fecha) => {
              if (fecha > today) {
                return <span key={fecha} className="aspect-square w-full" />
              }
              const log = byFecha.get(fecha)
              const nivel = log ? dailyPoints(log).habitsDone : 0
              return (
                <span
                  key={fecha}
                  title={`${fecha} · ${nivel}/4`}
                  className={`aspect-square w-full rounded-[3px] ${NIVELES[nivel]}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-600">
        <span>hace {weeks} semanas</span>
        <span className="flex items-center gap-1">
          0
          {NIVELES.map((n, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${n}`} />
          ))}
          4 hábitos
        </span>
        <span>hoy</span>
      </div>
    </div>
  )
}
