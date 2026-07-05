import { useEffect, useState } from 'react'
import type { CardioSession, DailyLog, ExerciseDayLog, RoutineItem } from '../../types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../hooks/useProfile'
import { isoWeekday } from '../../lib/days'
import { Modal } from '../ui/Modal'
import { HabitToggle } from '../HabitToggle'

const HABITOS = [
  { key: 'exercise_done', label: 'Ejercicio' },
  { key: 'diet_done', label: 'Dieta' },
  { key: 'sleep_done', label: 'Sueño' },
  { key: 'hydration_done', label: 'Hidratación' },
] as const

interface Props {
  fecha: string | null
  items: RoutineItem[]
  cardio: CardioSession[]
  dayTitle: string | null
  onClose: () => void
  onChanged: () => void
}

/**
 * Panel de un día del calendario: cumplimiento de los 4 hábitos, agua,
 * sueño y la rutina de ese día de la semana con kg/notas POR FECHA
 * (tabla exercise_day_logs, migración 0003).
 */
export function DaySheet({ fecha, items, cardio, dayTitle, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [log, setLog] = useState<Partial<DailyLog> | null>(null)
  const [edl, setEdl] = useState<Map<string, ExerciseDayLog>>(new Map())
  const [sleepStr, setSleepStr] = useState('')
  const [notasDia, setNotasDia] = useState('')
  const [faltaMigracion, setFaltaMigracion] = useState(false)
  const [borradores, setBorradores] = useState<Record<string, { peso?: string; notas?: string }>>({})

  useEffect(() => {
    if (!fecha || !user) return
    setLog(null)
    setEdl(new Map())
    setBorradores({})
    setFaltaMigracion(false)
    void supabase
      .from('daily_log')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()
      .then(({ data }) => {
        setLog(data ?? {})
        setSleepStr(data?.sleep_hours != null ? String(data.sleep_hours) : '')
        setNotasDia(data?.notas ?? '')
      })
    void supabase
      .from('exercise_day_logs')
      .select('*')
      .eq('fecha', fecha)
      .then(({ data, error }) => {
        if (error) {
          // Tabla aún sin crear (migración 0003 sin aplicar):
          // Postgres da 42P01 y PostgREST da PGRST205 (schema cache)
          if (error.code === '42P01' || error.code === 'PGRST205') setFaltaMigracion(true)
          return
        }
        setEdl(new Map((data as ExerciseDayLog[]).map((r) => [r.exercise_id, r])))
      })
  }, [fecha, user])

  if (!fecha) return null

  const upsertDia = async (patch: Partial<DailyLog>) => {
    if (!user) return
    const { data } = await supabase
      .from('daily_log')
      .upsert({ user_id: user.id, fecha, ...patch }, { onConflict: 'user_id,fecha' })
      .select()
      .single()
    if (data) setLog(data)
    onChanged()
  }

  // Reglas automáticas (con corrección manual siempre disponible en los toggles)
  const setAgua = (ml: number) =>
    upsertDia({
      water_ml: ml,
      ...(profile ? { hydration_done: ml >= profile.water_goal_ml } : {}),
    })

  const setSueno = (horas: number | null) =>
    upsertDia({
      sleep_hours: horas,
      ...(profile
        ? { sleep_done: horas != null && horas >= profile.sleep_goal_hours }
        : {}),
    })

  const upsertEjercicio = async (exerciseId: string) => {
    if (!user || faltaMigracion) return
    const draft = borradores[exerciseId]
    if (!draft) return
    const previo = edl.get(exerciseId)
    const pesoStr = (draft.peso ?? (previo?.peso != null ? String(previo.peso) : '')).trim()
    const peso = pesoStr === '' ? null : parseFloat(pesoStr.replace(',', '.'))
    const notas = (draft.notas ?? previo?.notas ?? '').trim() || null
    const { data, error } = await supabase
      .from('exercise_day_logs')
      .upsert(
        {
          user_id: user.id,
          exercise_id: exerciseId,
          fecha,
          peso: peso != null && !Number.isNaN(peso) ? peso : null,
          notas,
        },
        { onConflict: 'user_id,exercise_id,fecha' },
      )
      .select()
      .single()
    if (!error && data) {
      setEdl((m) => new Map(m).set(exerciseId, data as ExerciseDayLog))
    }
  }

  const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const weekday = isoWeekday(new Date(`${fecha}T12:00:00`))

  return (
    <Modal open onClose={onClose} title={titulo.charAt(0).toUpperCase() + titulo.slice(1)}>
      <div className="flex flex-col gap-5 pb-4">
        {/* Hábitos del día */}
        <div className="grid grid-cols-2 gap-2.5">
          {HABITOS.map((h) => (
            <HabitToggle
              key={h.key}
              label={h.label}
              active={Boolean(log?.[h.key])}
              disabled={log === null}
              onToggle={() => void upsertDia({ [h.key]: !log?.[h.key] })}
            />
          ))}
        </div>

        {/* Agua y sueño */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Agua
            </p>
            <p className="mt-1 font-display text-xl font-bold">
              {log?.water_ml ?? 0}
              <span className="text-sm font-medium text-zinc-500"> ml</span>
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => void setAgua((log?.water_ml ?? 0) + 250)}
                className="flex-1 rounded-lg bg-ink-raised py-1.5 text-xs font-semibold text-zinc-300 hover:text-accent"
              >
                +250
              </button>
              <button
                type="button"
                onClick={() => void setAgua((log?.water_ml ?? 0) + 500)}
                className="flex-1 rounded-lg bg-ink-raised py-1.5 text-xs font-semibold text-zinc-300 hover:text-accent"
              >
                +500
              </button>
              <button
                type="button"
                aria-label="Poner agua a cero"
                onClick={() => void setAgua(0)}
                className="rounded-lg bg-ink-raised px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ↺
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sueño
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={sleepStr}
                onChange={(e) => setSleepStr(e.target.value)}
                onBlur={() => {
                  const v = sleepStr.trim().replace(',', '.')
                  const n = v === '' ? null : parseFloat(v)
                  void setSueno(n != null && !Number.isNaN(n) ? n : null)
                }}
                placeholder="—"
                className="w-14 rounded-lg border border-ink-border bg-ink-soft px-2 py-1 text-center font-display text-xl font-bold text-zinc-100 outline-none focus:border-accent"
              />
              <span className="text-sm text-zinc-500">horas</span>
            </div>
          </div>
        </div>

        {/* Notas del día */}
        <input
          value={notasDia}
          onChange={(e) => setNotasDia(e.target.value)}
          onBlur={() => void upsertDia({ notas: notasDia.trim() || null })}
          placeholder="Notas del día…"
          className="min-h-11 rounded-xl border border-ink-border bg-ink-soft px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent"
        />

        {/* Entrenamiento de ese día de la semana */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {dayTitle ?? (weekday === 7 ? 'Descanso total' : 'Sin entrenamiento asignado')}
          </p>

          {faltaMigracion && (
            <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
              Para guardar kg y notas por día, ejecuta la migración{' '}
              <code className="text-amber-700">0003_exercise_day_logs.sql</code> en el SQL
              Editor de Supabase.
            </p>
          )}

          {items.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((it) => {
                const previo = edl.get(it.exercise_id)
                const draft = borradores[it.exercise_id] ?? {}
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border border-ink-border bg-ink-card px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-zinc-100">
                        {it.exercise.nombre}
                      </p>
                      <p className="shrink-0 text-xs text-zinc-500">
                        {it.series}×{it.reps}
                      </p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={faltaMigracion}
                        value={draft.peso ?? (previo?.peso != null ? String(previo.peso) : '')}
                        onChange={(e) =>
                          setBorradores((b) => ({
                            ...b,
                            [it.exercise_id]: { ...b[it.exercise_id], peso: e.target.value },
                          }))
                        }
                        onBlur={() => void upsertEjercicio(it.exercise_id)}
                        placeholder="kg"
                        className="w-20 rounded-lg border border-ink-border bg-ink-soft px-2 py-2 text-center font-display text-sm font-semibold text-zinc-100 outline-none focus:border-accent disabled:opacity-40"
                      />
                      <input
                        type="text"
                        disabled={faltaMigracion}
                        value={draft.notas ?? previo?.notas ?? ''}
                        onChange={(e) =>
                          setBorradores((b) => ({
                            ...b,
                            [it.exercise_id]: { ...b[it.exercise_id], notas: e.target.value },
                          }))
                        }
                        onBlur={() => void upsertEjercicio(it.exercise_id)}
                        placeholder="Nota de ese día…"
                        className="min-w-0 flex-1 rounded-lg border border-ink-border bg-ink-soft px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent disabled:opacity-40"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {cardio.map((c) => (
            <p
              key={c.id}
              className="mt-2 rounded-xl bg-ink-card px-4 py-3 text-sm text-zinc-400"
            >
              Cardio · {[c.tipo, c.duracion_min != null ? `${c.duracion_min} min` : null, c.momento]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ))}
        </div>
      </div>
    </Modal>
  )
}
