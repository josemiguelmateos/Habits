import { useState } from 'react'
import type { Exercise, RoutineDay } from '../../types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Props {
  day: RoutineDay | null
  exercises: Exercise[]
  usedExerciseIds: Set<string>
  nextOrden: number
  onClose: () => void
  onChanged: () => void
}

export function AddExerciseSheet({
  day,
  exercises,
  usedExerciseIds,
  nextOrden,
  onClose,
  onChanged,
}: Props) {
  const { user } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoGrupo, setNuevoGrupo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!day) return null

  const filtrados = exercises.filter((e) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      e.nombre.toLowerCase().includes(q) ||
      (e.grupo_muscular ?? '').toLowerCase().includes(q)
    )
  })

  const asignar = async (exerciseId: string) => {
    if (!user) return
    setTrabajando(true)
    setError(null)
    const { error: err } = await supabase.from('routine_day_exercises').insert({
      user_id: user.id,
      routine_day_id: day.id,
      exercise_id: exerciseId,
      orden: nextOrden,
      series: 4,
      reps: '10',
      descanso_seg: 60,
    })
    setTrabajando(false)
    if (err) {
      setError(err.message)
      return
    }
    onChanged()
    onClose()
  }

  const crearYAsignar = async () => {
    if (!user || !nuevoNombre.trim()) return
    setTrabajando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id,
        nombre: nuevoNombre.trim(),
        grupo_muscular: nuevoGrupo.trim() || null,
      })
      .select('id')
      .single()
    if (err || !data) {
      setTrabajando(false)
      setError(err?.message ?? 'No se pudo crear')
      return
    }
    await asignar(data.id as string)
  }

  return (
    <Modal open onClose={onClose} title={`Añadir a ${day.titulo}`}>
      <div className="flex flex-col gap-4 pb-4">
        {!creando ? (
          <>
            <Input
              label="Buscar en tu catálogo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o grupo muscular…"
            />
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filtrados.map((e) => {
                const usado = usedExerciseIds.has(e.id)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={usado || trabajando}
                      onClick={() => void asignar(e.id)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors enabled:hover:bg-ink-raised disabled:opacity-40"
                    >
                      <span>
                        <span className="block text-sm font-medium text-zinc-200">
                          {e.nombre}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {e.grupo_muscular ?? '—'}
                        </span>
                      </span>
                      {usado ? (
                        <span className="text-xs text-zinc-600">Ya en este día</span>
                      ) : (
                        <span className="text-accent">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {filtrados.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-zinc-500">
                  Nada con ese nombre.
                </li>
              )}
            </ul>
            <Button variant="secondary" onClick={() => setCreando(true)}>
              Crear ejercicio nuevo
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Nombre del ejercicio"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Ej.: Face pull"
            />
            <Input
              label="Grupo muscular"
              value={nuevoGrupo}
              onChange={(e) => setNuevoGrupo(e.target.value)}
              placeholder="Ej.: Hombro"
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setCreando(false)} className="flex-1">
                Volver
              </Button>
              <Button
                onClick={() => void crearYAsignar()}
                disabled={trabajando || !nuevoNombre.trim()}
                className="flex-1"
              >
                {trabajando ? 'Creando…' : 'Crear y añadir'}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
