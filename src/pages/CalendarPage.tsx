import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import { supabase } from '../lib/supabase'
import { isoWeekday, localDateStr } from '../lib/days'
import type { DailyLog } from '../types'
import { DaySheet } from '../components/calendar/DaySheet'

const HABIT_KEYS = ['exercise_done', 'diet_done', 'sleep_done', 'hydration_done'] as const

export function CalendarPage() {
  const { user } = useAuth()
  const rutina = useRoutine()
  const hoyStr = localDateStr()

  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() } // m: 0-11
  })
  const [logs, setLogs] = useState<Map<string, DailyLog>>(new Map())
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  const primerDia = new Date(cursor.y, cursor.m, 1)
  const diasEnMes = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const offset = isoWeekday(primerDia) - 1 // huecos antes del día 1

  const cargarMes = useCallback(async () => {
    if (!user) return
    const desde = localDateStr(new Date(cursor.y, cursor.m, 1))
    const hasta = localDateStr(new Date(cursor.y, cursor.m, diasEnMes))
    const { data } = await supabase
      .from('daily_log')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
    setLogs(new Map(((data as DailyLog[]) ?? []).map((l) => [l.fecha, l])))
  }, [user, cursor.y, cursor.m, diasEnMes])

  useEffect(() => {
    void cargarMes()
  }, [cargarMes])

  const tituloMes = primerDia.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // Rutina del día seleccionado (por día de la semana)
  const seleccion = useMemo(() => {
    if (!seleccionado) return null
    const wd = isoWeekday(new Date(`${seleccionado}T12:00:00`))
    const day = rutina.days.find((d) => d.weekday === wd) ?? null
    return {
      items: day ? (rutina.itemsByDay.get(day.id) ?? []) : [],
      cardio: rutina.cardio.filter((c) => c.weekday === wd),
      dayTitle: day?.titulo ?? null,
    }
  }, [seleccionado, rutina.days, rutina.itemsByDay, rutina.cardio])

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {/* Cabecera de mes */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-card text-zinc-400 transition-colors hover:text-accent"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <h2 className="font-display text-lg font-semibold capitalize">{tituloMes}</h2>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-card text-zinc-400 transition-colors hover:text-accent"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* Rejilla */}
      <div className="card px-3 py-4">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="pb-1 text-[11px] font-semibold uppercase text-zinc-600">
              {d}
            </span>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`h${i}`} />
          ))}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1
            const fecha = localDateStr(new Date(cursor.y, cursor.m, dia))
            const log = logs.get(fecha)
            const esHoy = fecha === hoyStr
            const esFuturo = fecha > hoyStr
            return (
              <button
                key={fecha}
                type="button"
                onClick={() => setSeleccionado(fecha)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-colors ${
                  esHoy
                    ? 'border-accent bg-accent/10'
                    : 'border-transparent bg-ink-soft hover:border-ink-border'
                } ${esFuturo ? 'opacity-40' : ''}`}
              >
                <span
                  className={`font-display text-sm font-semibold ${
                    esHoy ? 'text-accent' : 'text-zinc-300'
                  }`}
                >
                  {dia}
                </span>
                <span className="flex gap-[3px]">
                  {HABIT_KEYS.map((k) => (
                    <span
                      key={k}
                      className={`h-[5px] w-[5px] rounded-full ${
                        log
                          ? log[k]
                            ? 'bg-accent'
                            : 'bg-zinc-700'
                          : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        {/* Leyenda */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-accent" /> cumplido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-700" /> no cumplido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-800" /> sin registrar
          </span>
        </div>
      </div>

      <p className="px-1 text-center text-xs text-zinc-600">
        Toca un día para marcar hábitos y apuntar kg y notas de cada ejercicio.
      </p>

      <DaySheet
        fecha={seleccionado}
        items={seleccion?.items ?? []}
        cardio={seleccion?.cardio ?? []}
        dayTitle={seleccion?.dayTitle ?? null}
        onClose={() => setSeleccionado(null)}
        onChanged={() => void cargarMes()}
      />
    </div>
  )
}
