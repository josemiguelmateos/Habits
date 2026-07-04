import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import { importInitialRoutine } from '../lib/importRoutine'
import { supabase } from '../lib/supabase'
import { isoWeekday } from '../lib/days'
import type { CardioSession, RoutineDay, RoutineItem } from '../types'
import { Button } from '../components/ui/Button'
import { DayCard } from '../components/routine/DayCard'
import { ExerciseSheet } from '../components/routine/ExerciseSheet'
import { AddExerciseSheet } from '../components/routine/AddExerciseSheet'
import { ImportJsonSheet } from '../components/routine/ImportJsonSheet'
import { CardioSheet } from '../components/routine/CardioSheet'

const BLANK_KEY = 'habits:empezar-en-blanco'

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

  const hoy = isoWeekday()

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
              Pegar mi rutina (JSON)
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
            <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {importError}
            </p>
          )}
        </div>
        <ImportJsonSheet
          open={jsonAbierto}
          onClose={() => setJsonAbierto(false)}
          onChanged={() => void rutina.reload()}
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
