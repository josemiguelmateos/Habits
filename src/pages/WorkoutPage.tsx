import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import { supabase } from '../lib/supabase'
import { isoWeekday, localDateStr } from '../lib/days'
import { dailyPoints } from '../lib/score'
import { uploadExercisePhoto } from '../lib/media'
import { maxPorEjercicio, formatKg } from '../lib/stats'
import type { RoutineItem } from '../types'
import { ExerciseMedia } from '../components/media/ExerciseMedia'
import { RestTimer } from '../components/workout/RestTimer'
import { Celebration } from '../components/workout/Celebration'
import { PrToast, type PrEvent } from '../components/workout/PrToast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { sparklineSeries } from '../lib/sparkline'
import type { SetLike, PesoFecha } from '../lib/stats'
import { Sparkline } from '../components/exercise/Sparkline'
import { loadDraft, saveDraft, pruneOldDrafts } from '../lib/workoutDraft'

interface TimerState {
  seconds: number
  runKey: number
}

export function WorkoutPage() {
  const { user } = useAuth()
  const rutina = useRoutine()
  const hoy = isoWeekday()
  const fotoRef = useRef<HTMLInputElement>(null)

  const [idx, setIdx] = useState(0)
  const [hechas, setHechas] = useState<Record<string, boolean[]>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.hechas ?? {},
  )
  const [pesos, setPesos] = useState<Record<string, string>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.pesos ?? {},
  )
  const [repsPorSerie, setRepsPorSerie] = useState<Record<string, string[]>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.repsPorSerie ?? {},
  )
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [cardioHecho, setCardioHecho] = useState(false)
  const [terminando, setTerminando] = useState(false)
  const [celebracion, setCelebracion] = useState<{
    points: number
    habitsDone: number
    perfect: boolean
  } | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  // Récords personales: máximos históricos (antes de hoy) por ejercicio
  const [histMax, setHistMax] = useState<Map<string, number>>(new Map())
  const [prs, setPrs] = useState<PrEvent[]>([])
  const [prToast, setPrToast] = useState<PrEvent | null>(null)
  const [sparks, setSparks] = useState<
    Map<string, { values: number[]; metrica: 'oneRM' | 'pesoMax' }>
  >(new Map())

  useEffect(() => {
    if (!user) return
    void (async () => {
      const hoyStr = localDateStr()
      const [sl, edl] = await Promise.all([
        supabase
          .from('set_logs')
          .select('exercise_id, fecha, reps_hechas, peso_usado')
          .lt('fecha', hoyStr),
        supabase.from('exercise_day_logs').select('exercise_id, fecha, peso').lt('fecha', hoyStr),
      ])
      const registros = [
        ...(sl.data ?? []).map((r) => ({
          exercise_id: r.exercise_id as string,
          fecha: r.fecha as string,
          peso: r.peso_usado as number | null,
        })),
        ...(edl.data ?? []).map((r) => ({
          exercise_id: r.exercise_id as string,
          fecha: r.fecha as string,
          peso: r.peso as number | null,
        })),
      ]
      setHistMax(new Map([...maxPorEjercicio(registros)].map(([k, v]) => [k, v.peso])))

      const setsByEx = new Map<string, SetLike[]>()
      for (const r of (sl.data ?? []) as SetLike[]) {
        const a = setsByEx.get(r.exercise_id) ?? []
        a.push(r)
        setsByEx.set(r.exercise_id, a)
      }
      const daysByEx = new Map<string, PesoFecha[]>()
      for (const r of (edl.data ?? []) as PesoFecha[]) {
        const a = daysByEx.get(r.exercise_id) ?? []
        a.push(r)
        daysByEx.set(r.exercise_id, a)
      }
      const sparkMap = new Map<string, { values: number[]; metrica: 'oneRM' | 'pesoMax' }>()
      for (const id of new Set([...setsByEx.keys(), ...daysByEx.keys()])) {
        sparkMap.set(id, sparklineSeries(setsByEx.get(id) ?? [], daysByEx.get(id) ?? []))
      }
      setSparks(sparkMap)
    })()
  }, [user])

  // Limpia borradores de días anteriores de este usuario.
  useEffect(() => {
    if (!user) return
    pruneOldDrafts(user.id, localDateStr())
  }, [user])

  // Guarda el progreso del día en cada cambio (restaura al volver a entrar).
  useEffect(() => {
    if (!user) return
    saveDraft(user.id, localDateStr(), { hechas, pesos, repsPorSerie })
  }, [user, hechas, pesos, repsPorSerie])

  const day = rutina.days.find((d) => d.weekday === hoy) ?? null
  const items = useMemo(
    () => (day ? (rutina.itemsByDay.get(day.id) ?? []) : []),
    [day, rutina.itemsByDay],
  )
  const cardioHoy = rutina.cardio.filter((c) => c.weekday === hoy)

  if (rutina.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Domingo o día sin nada
  if (!day && cardioHoy.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Habits
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold">
          {hoy === 7 ? 'Hoy toca descanso total' : 'Hoy no hay entrenamiento'}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-zinc-500">
          {hoy === 7
            ? 'La recuperación también construye músculo. Nos vemos el lunes.'
            : 'Puedes asignar un entrenamiento a este día desde la rutina.'}
        </p>
        <Link to="/" className="mt-8 font-semibold text-accent">
          Volver al inicio
        </Link>
      </div>
    )
  }

  // Reps reales por serie (por defecto, el primer número del objetivo)
  const repsDeSerie = (it: RoutineItem, serie: number): number => {
    const raw = (repsPorSerie[it.id]?.[serie] ?? '').trim()
    const n = raw === '' ? parseInt(it.reps, 10) : parseInt(raw, 10)
    return Number.isNaN(n) ? 0 : n
  }

  const setRepsSerie = (itemId: string, serie: number, valor: string) => {
    setRepsPorSerie((prev) => {
      const arr = prev[itemId] ? [...prev[itemId]] : []
      arr[serie] = valor
      return { ...prev, [itemId]: arr }
    })
  }

  const totalSeries = items.reduce((acc, it) => acc + it.series, 0)
  const seriesHechas = Object.values(hechas).flat().filter(Boolean).length
  const volumenSesion = Math.round(
    items.reduce((acc, it) => {
      const done = hechas[it.id] ?? []
      const pesoStr = (pesos[it.id] ?? (it.peso != null ? String(it.peso) : ''))
        .trim()
        .replace(',', '.')
      const p = parseFloat(pesoStr)
      if (Number.isNaN(p)) return acc
      let sub = 0
      for (let s = 0; s < it.series; s++) {
        if (done[s]) sub += p * repsDeSerie(it, s)
      }
      return acc + sub
    }, 0),
  )
  const enCardio = idx >= items.length && cardioHoy.length > 0
  const item: RoutineItem | undefined = items[idx]

  const marcarSerie = (it: RoutineItem, serie: number, valor: boolean) => {
    setHechas((prev) => {
      const arr = [...(prev[it.id] ?? Array<boolean>(it.series).fill(false))]
      arr[serie] = valor
      return { ...prev, [it.id]: arr }
    })
    if (valor) {
      setTimer((t) => ({ seconds: it.descanso_seg, runKey: (t?.runKey ?? 0) + 1 }))
      const pesoStr = (pesos[it.id] ?? (it.peso != null ? String(it.peso) : '')).trim()
      const peso = pesoStr === '' ? null : parseFloat(pesoStr.replace(',', '.'))

      // ¿Récord personal? Solo si ya había un máximo previo que superar
      if (peso != null && !Number.isNaN(peso)) {
        const previo = histMax.get(it.exercise_id)
        if (previo != null && peso > previo) {
          const pr: PrEvent = {
            nombre: it.exercise.nombre,
            peso,
            delta: Math.round((peso - previo) * 100) / 100,
          }
          setHistMax((m) => new Map(m).set(it.exercise_id, peso))
          setPrs((p) => [...p, pr])
          setPrToast(pr)
        }
      }
      // .then() es imprescindible: el builder de supabase-js es lazy y sin
      // await/then la petición no llega a lanzarse
      supabase
        .from('set_logs')
        .insert({
          user_id: user!.id,
          exercise_id: it.exercise_id,
          fecha: localDateStr(),
          serie: serie + 1,
          reps_hechas: repsDeSerie(it, serie) || null,
          peso_usado: peso != null && !Number.isNaN(peso) ? peso : null,
        })
        .then(({ error }) => {
          if (error) console.error('set_log:', error.message)
        })
    } else {
      // Al desmarcar, retira la serie de set_logs para no ensuciar el historial.
      supabase
        .from('set_logs')
        .delete()
        .match({
          user_id: user!.id,
          exercise_id: it.exercise_id,
          fecha: localDateStr(),
          serie: serie + 1,
        })
        .then(({ error }) => {
          if (error) console.error('set_log del:', error.message)
        })
    }
  }

  const guardarPeso = async (it: RoutineItem) => {
    const raw = (pesos[it.id] ?? '').trim().replace(',', '.')
    if (raw === '') return
    const nuevo = parseFloat(raw)
    if (Number.isNaN(nuevo) || nuevo === it.peso) return
    await supabase.from('routine_day_exercises').update({ peso: nuevo }).eq('id', it.id)
  }

  const terminar = async () => {
    if (!user) return
    setTerminando(true)
    const fecha = localDateStr()
    await supabase
      .from('daily_log')
      .upsert(
        { user_id: user.id, fecha, exercise_done: true },
        { onConflict: 'user_id,fecha' },
      )
    const { data } = await supabase
      .from('daily_log')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()
    const p = dailyPoints(data)
    setTerminando(false)
    setCelebracion({ points: p.points, habitsDone: p.habitsDone, perfect: p.perfect })
  }

  const onFotoWorkout = async (f: File | undefined) => {
    if (!f || !user || !item) return
    setSubiendoFoto(true)
    try {
      await uploadExercisePhoto(user.id, item.exercise_id, f)
      await rutina.reload()
    } finally {
      setSubiendoFoto(false)
    }
  }

  if (celebracion) {
    return (
      <Celebration
        seriesHechas={seriesHechas}
        ejercicios={items.length}
        points={celebracion.points}
        habitsDone={celebracion.habitsDone}
        perfect={celebracion.perfect}
        volumenKg={volumenSesion}
        prs={prs}
      />
    )
  }

  return (
    <div className="min-h-dvh pb-36">
      {/* Cabecera propia (modo inmersivo, sin nav inferior) */}
      <header className="sticky top-0 z-10 border-b border-ink-border/60 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
          <Link to="/" aria-label="Salir del entrenamiento" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-ink-raised hover:text-zinc-100">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-sm font-semibold">
              {day?.titulo ?? 'Cardio'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {seriesHechas}/{totalSeries} series
              {volumenSesion > 0 && ` · ${formatKg(volumenSesion)}`}
            </p>
          </div>
          <span className="w-9" />
        </div>
        <div className="h-0.5 bg-ink-raised">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${totalSeries ? (seriesHechas / totalSeries) * 100 : 0}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">
        {!enCardio && item ? (
          <div key={item.id} className="animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Ejercicio {idx + 1} de {items.length}
              {cardioHoy.length > 0 ? ' · después cardio' : ''}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
              {item.exercise.nombre}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {item.exercise.grupo_muscular} · objetivo {item.series}×{item.reps}
              {item.peso != null ? ` · ${item.peso} kg` : ''} · descanso{' '}
              {item.descanso_seg}&Prime;
            </p>
            {(() => {
              const s = sparks.get(item.exercise_id)
              if (!s || s.values.length < 2) return null
              return (
                <div className="mt-2 flex items-center gap-2">
                  <Sparkline values={s.values} width={110} height={30} />
                  <span className="text-xs text-zinc-500">
                    {s.metrica === 'oneRM' ? '1RM' : 'Peso'} ·{' '}
                    {s.values[s.values.length - 1]} kg
                  </span>
                </div>
              )
            })()}

            <div className="mt-4">
              <ExerciseMedia
                exercise={item.exercise}
                seriesReps={`${item.series}×${item.reps}`}
              />
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void onFotoWorkout(e.target.files?.[0])}
              />
              {!item.exercise.video_url && !item.exercise.photo_url && (
                <button
                  type="button"
                  disabled={subiendoFoto}
                  onClick={() => fotoRef.current?.click()}
                  className="mt-2 text-xs font-semibold text-accent"
                >
                  {subiendoFoto ? 'Subiendo…' : 'Hacer foto de la máquina ahora'}
                </button>
              )}
            </div>

            {/* Peso de hoy (global para el ejercicio; las reps van por serie) */}
            <div className="mt-5 flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-400" htmlFor="peso-hoy">
                Peso de hoy
              </label>
              <input
                id="peso-hoy"
                type="text"
                inputMode="decimal"
                placeholder={item.peso != null ? String(item.peso) : 'kg'}
                value={pesos[item.id] ?? ''}
                onChange={(e) => setPesos((p) => ({ ...p, [item.id]: e.target.value }))}
                onBlur={() => void guardarPeso(item)}
                className="w-24 rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5 text-center font-display text-lg font-semibold text-zinc-100 outline-none focus:border-accent"
              />
              <span className="text-sm text-zinc-500">kg</span>
            </div>

            {/* Series */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {Array.from({ length: item.series }).map((_, s) => {
                const hecha = hechas[item.id]?.[s] ?? false
                return (
                  <div
                    key={s}
                    className={`flex min-h-14 items-center gap-1.5 rounded-xl border pl-4 pr-2 transition-all ${
                      hecha
                        ? 'border-accent bg-accent/15'
                        : 'border-ink-border bg-ink-card'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => marcarSerie(item, s, !hecha)}
                      aria-pressed={hecha}
                      className={`flex-1 self-stretch text-left font-display text-sm font-semibold ${
                        hecha ? 'text-accent' : 'text-zinc-300'
                      }`}
                    >
                      Serie {s + 1}
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Reps de la serie ${s + 1}`}
                      value={repsPorSerie[item.id]?.[s] ?? String(parseInt(item.reps, 10) || '')}
                      onChange={(e) => setRepsSerie(item.id, s, e.target.value)}
                      className={`w-11 rounded-lg border bg-ink-soft py-1.5 text-center font-display text-sm font-semibold outline-none focus:border-accent ${
                        hecha ? 'border-accent/40 text-accent' : 'border-ink-border text-zinc-100'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => marcarSerie(item, s, !hecha)}
                      aria-label={hecha ? `Desmarcar serie ${s + 1}` : `Marcar serie ${s + 1}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center active:scale-90"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          hecha ? 'border-accent bg-accent text-accent-ink' : 'border-zinc-600'
                        }`}
                      >
                        {hecha && (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {item.notas && (
              <p className="mt-4 rounded-xl bg-ink-card px-4 py-3 text-sm text-zinc-400">
                {item.notas}
              </p>
            )}

            {/* Navegación */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                disabled={idx === 0}
                onClick={() => setIdx((i) => i - 1)}
                className="flex-1"
              >
                Anterior
              </Button>
              {idx < items.length - 1 || cardioHoy.length > 0 ? (
                <Button onClick={() => setIdx((i) => i + 1)} className="flex-1">
                  Siguiente
                </Button>
              ) : (
                <Button
                  onClick={() => void terminar()}
                  disabled={terminando}
                  className="flex-1"
                >
                  {terminando ? 'Guardando…' : 'Terminar'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Bloque de cardio (final o único) */
          <div className="animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {items.length > 0 ? 'Último bloque' : 'Sesión de hoy'}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">Cardio</h2>
            {cardioHoy.map((c) => (
              <div key={c.id} className="card mt-4 px-5 py-4">
                <p className="font-display text-3xl font-bold text-accent">
                  {c.duracion_min ?? '—'} min
                </p>
                <p className="mt-1 text-sm capitalize text-zinc-300">
                  {[c.tipo, c.momento].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {[c.metodo, c.zona_velocidad].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCardioHecho((v) => !v)}
              aria-pressed={cardioHecho}
              className={`mt-4 flex w-full min-h-14 items-center justify-between rounded-xl border px-4 transition-all active:scale-[0.98] ${
                cardioHecho
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-ink-border bg-ink-card text-zinc-300'
              }`}
            >
              <span className="font-display text-sm font-semibold">Cardio completado</span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  cardioHecho ? 'border-accent bg-accent text-accent-ink' : 'border-zinc-600'
                }`}
              >
                {cardioHecho && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
            <div className="mt-6 flex gap-3">
              {items.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setIdx(items.length - 1)}
                  className="flex-1"
                >
                  Anterior
                </Button>
              )}
              <Button
                onClick={() => void terminar()}
                disabled={terminando || (items.length === 0 && !cardioHecho)}
                className="flex-1"
              >
                {terminando ? 'Guardando…' : 'Terminar'}
              </Button>
            </div>
          </div>
        )}
      </main>

      {prToast && <PrToast pr={prToast} onDone={() => setPrToast(null)} />}

      {timer && (
        <RestTimer
          seconds={timer.seconds}
          runKey={timer.runKey}
          onDismiss={() => setTimer(null)}
        />
      )}
    </div>
  )
}
