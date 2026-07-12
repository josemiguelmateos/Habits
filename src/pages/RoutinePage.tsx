import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import {
  importInitialRoutine,
  importRoutineData,
  validateRutinaJson,
} from '../lib/importRoutine'
import { supabase } from '../lib/supabase'
import { isoWeekday } from '../lib/days'
import { sparklineSeries } from '../lib/sparkline'
import type { SetLike, PesoFecha } from '../lib/stats'
import type { CardioSession, RoutineDay, RoutineItem } from '../types'
import { Button } from '../components/ui/Button'
import { DayCard } from '../components/routine/DayCard'
import { ExerciseSheet } from '../components/routine/ExerciseSheet'
import { AddExerciseSheet } from '../components/routine/AddExerciseSheet'
import { ImportSheet } from '../components/import/ImportSheet'
import { CardioSheet } from '../components/routine/CardioSheet'

const BLANK_KEY = 'habits:empezar-en-blanco'

const EJEMPLO_RUTINA = `{
  "ejercicios": {
    "press_banca": { "nombre": "Press banca", "grupo": "Pecho" }
  },
  "rutina": [
    { "dia": "lunes", "titulo": "Torso", "items": [
      { "ejercicio": "press_banca", "orden": 1, "series": 4, "reps": "10", "descanso_seg": 90 }
    ]}
  ]
}`

export function RoutinePage() {
  const { user } = useAuth()
  const rutina = useRoutine()
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [abierto, setAbierto] = useState<RoutineItem | null>(null)
  const [anadiendoA, setAnadiendoA] = useState<RoutineDay | null>(null)
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [jsonAbierto, setJsonAbierto] = useState(false)
  const [cardioEdit, setCardioEdit] = useState<CardioSession | null>(null)
  const [cardioNuevoDia, setCardioNuevoDia] = useState<number | null>(null)
  const [enBlanco, setEnBlanco] = useState(() => localStorage.getItem(BLANK_KEY) === '1')
  const [sparklines, setSparklines] = useState<Map<string, number[]>>(new Map())

  const hoy = isoWeekday()

  useEffect(() => {
    if (!user) return
    void (async () => {
      const [sl, edl] = await Promise.all([
        supabase.from('set_logs').select('exercise_id, fecha, reps_hechas, peso_usado'),
        supabase.from('exercise_day_logs').select('exercise_id, fecha, peso'),
      ])
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
      const m = new Map<string, number[]>()
      for (const id of new Set([...setsByEx.keys(), ...daysByEx.keys()])) {
        m.set(id, sparklineSeries(setsByEx.get(id) ?? [], daysByEx.get(id) ?? []).values)
      }
      setSparklines(m)
    })()
  }, [user])

  // Mantén la ficha abierta sincronizada tras un reload
  const abiertoActual = useMemo(() => {
    if (!abierto) return null
    return rutina.items.find((i) => i.id === abierto.id) ?? null
  }, [abierto, rutina.items])

  const importar = async () => {
    if (!user) return
    setImportando(true)
    setImportError(null)
    try {
      await importInitialRoutine(user.id)
      await rutina.reload()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImportando(false)
    }
  }

  const crearDia = async (weekday: number) => {
    if (!user) return
    const titulo = prompt('Título del entrenamiento (ej. "Full body")')
    if (!titulo?.trim()) return
    await supabase
      .from('routine_days')
      .insert({ user_id: user.id, weekday, titulo: titulo.trim() })
    await rutina.reload()
  }

  const resetear = async () => {
    if (!user) return
    if (
      !confirm(
        '¿Borrar tu rutina e importar otra? Se borrarán los ejercicios, días y cardio (y el historial de cargas asociado).',
      )
    )
      return
    // Borrar exercises arrastra en cascada routine_day_exercises, set_logs y
    // exercise_day_logs; routine_days y cardio_sessions van aparte.
    await supabase.from('routine_days').delete().eq('user_id', user.id)
    await supabase.from('cardio_sessions').delete().eq('user_id', user.id)
    await supabase.from('exercises').delete().eq('user_id', user.id)
    localStorage.removeItem(BLANK_KEY)
    setEnBlanco(false)
    await rutina.reload()
  }

  if (rutina.loading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-40 animate-pulse bg-ink-card" />
        ))}
      </div>
    )
  }

  const sinRutina =
    rutina.days.length === 0 && rutina.exercises.length === 0 && rutina.cardio.length === 0

  if (sinRutina && !enBlanco) {
    return (
      <>
        <div className="card flex animate-fade-up flex-col items-center gap-5 px-6 py-12 text-center">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Empieza aquí
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold">Monta tu rutina</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
              Importa la rutina de ejemplo (5 días de pesas + cardio, 38 ejercicios),
              pega la tuya en JSON o construye la tuya desde cero.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            <Button onClick={() => void importar()} disabled={importando}>
              {importando ? 'Importando…' : 'Importar rutina de ejemplo'}
            </Button>
            <Button variant="secondary" onClick={() => setJsonAbierto(true)}>
              Importar archivo (PDF, Excel o JSON)
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.setItem(BLANK_KEY, '1')
                setEnBlanco(true)
              }}
            >
              Empezar en blanco
            </Button>
          </div>
          {importError && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {importError}
            </p>
          )}
        </div>
        <ImportSheet
          open={jsonAbierto}
          onClose={() => setJsonAbierto(false)}
          onChanged={() => void rutina.reload()}
          tipo="rutina"
          ejemplo={EJEMPLO_RUTINA}
          validate={validateRutinaJson}
          importData={importRoutineData}
        />
      </>
    )
  }

  const pendientes = rutina.mediaTotal - rutina.mediaDone

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {sinRutina && (
        <div className="card flex items-center justify-between px-5 py-3.5">
          <p className="text-sm text-zinc-500">Rutina en blanco.</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(BLANK_KEY)
              setEnBlanco(false)
            }}
            className="text-xs font-semibold text-accent hover:text-accent-bright"
          >
            Importar una rutina
          </button>
        </div>
      )}
      {/* Biblioteca de demostraciones */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-2xl font-bold leading-none">
              {rutina.mediaDone}
              <span className="text-base font-semibold text-zinc-500">
                /{rutina.mediaTotal}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">ejercicios con demostración</p>
          </div>
          {pendientes > 0 ? (
            <button
              type="button"
              onClick={() => setSoloPendientes((v) => !v)}
              aria-pressed={soloPendientes}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                soloPendientes
                  ? 'bg-accent text-accent-ink'
                  : 'bg-ink-raised text-zinc-300 hover:text-accent'
              }`}
            >
              {soloPendientes ? 'Ver todos' : `Ver ${pendientes} pendientes`}
            </button>
          ) : (
            <span className="rounded-full bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent">
              Biblioteca completa
            </span>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-raised">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{
              width: `${rutina.mediaTotal ? (rutina.mediaDone / rutina.mediaTotal) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* CTA de entrenamiento de hoy */}
      {(rutina.days.some((d) => d.weekday === hoy) ||
        rutina.cardio.some((c) => c.weekday === hoy)) && (
        <Link
          to="/entrenar"
          className="flex items-center justify-between rounded-2xl bg-accent px-5 py-4 text-accent-ink transition-transform active:scale-[0.99]"
        >
          <span>
            <span className="block font-display text-base font-bold">
              Empezar entrenamiento de hoy
            </span>
            <span className="block text-sm opacity-80">
              {rutina.days.find((d) => d.weekday === hoy)?.titulo ?? 'Cardio'}
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
        const day = rutina.days.find((d) => d.weekday === wd) ?? null
        return (
          <DayCard
            key={wd}
            weekday={wd}
            day={day}
            items={day ? (rutina.itemsByDay.get(day.id) ?? []) : []}
            cardio={rutina.cardio.filter((c) => c.weekday === wd)}
            soloPendientes={soloPendientes}
            sparklines={sparklines}
            onReorder={(dayId, ids) => void rutina.reorderDay(dayId, ids)}
            onOpenItem={setAbierto}
            onAdd={setAnadiendoA}
            onCreateDay={(w) => void crearDia(w)}
            onPesoChanged={() => void rutina.reload()}
            onOpenCardio={setCardioEdit}
            onAddCardio={setCardioNuevoDia}
          />
        )
      })}

      {!sinRutina && (
        <button
          type="button"
          onClick={() => void resetear()}
          className="mx-auto mt-1 text-xs font-semibold text-zinc-600 hover:text-accent"
        >
          Borrar rutina e importar otra
        </button>
      )}

      <ExerciseSheet
        item={abiertoActual}
        onClose={() => setAbierto(null)}
        onChanged={() => void rutina.reload()}
      />
      <AddExerciseSheet
        day={anadiendoA}
        exercises={rutina.exercises}
        usedExerciseIds={
          new Set(
            anadiendoA
              ? (rutina.itemsByDay.get(anadiendoA.id) ?? []).map((i) => i.exercise_id)
              : [],
          )
        }
        nextOrden={
          anadiendoA ? (rutina.itemsByDay.get(anadiendoA.id)?.length ?? 0) + 1 : 1
        }
        onClose={() => setAnadiendoA(null)}
        onChanged={() => void rutina.reload()}
      />
      <CardioSheet
        cardio={cardioEdit}
        nuevoWeekday={cardioNuevoDia}
        onClose={() => {
          setCardioEdit(null)
          setCardioNuevoDia(null)
        }}
        onChanged={() => void rutina.reload()}
      />
    </div>
  )
}
