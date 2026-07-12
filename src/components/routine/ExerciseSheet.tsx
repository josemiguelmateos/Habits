import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { RoutineItem, SetLog } from '../../types'
import type { PesoFecha } from '../../lib/stats'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { parseYouTubeUrl, searchUrl } from '../../lib/youtube'
import { uploadExercisePhoto, deleteExercisePhoto } from '../../lib/media'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Spinner } from '../ui/Spinner'
import { YouTubeFacade } from '../media/YouTubeFacade'
import { ExercisePhoto } from '../media/ExercisePhoto'

// Recharts se carga aparte al abrir la primera ficha; no entra en el bundle de rutina.
const ExerciseProgressChart = lazy(() => import('../exercise/ExerciseProgressChart'))

interface Props {
  item: RoutineItem | null
  onClose: () => void
  onChanged: () => void
}

export function ExerciseSheet({ item, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  // Campos del ejercicio
  const [nombre, setNombre] = useState('')
  const [grupo, setGrupo] = useState('')
  const [hint, setHint] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  // Parámetros del día
  const [series, setSeries] = useState('4')
  const [reps, setReps] = useState('')
  const [peso, setPeso] = useState('')
  const [descanso, setDescanso] = useState('60')
  const [notas, setNotas] = useState('')

  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SetLog[]>([])
  const [dayLogs, setDayLogs] = useState<PesoFecha[]>([])
  const [cargandoHist, setCargandoHist] = useState(false)

  useEffect(() => {
    if (!item) return
    setNombre(item.exercise.nombre)
    setGrupo(item.exercise.grupo_muscular ?? '')
    setHint(item.exercise.search_hint_en ?? '')
    setVideoUrl(item.exercise.video_url ?? '')
    setSeries(String(item.series))
    setReps(item.reps)
    setPeso(item.peso != null ? String(item.peso) : '')
    setDescanso(String(item.descanso_seg))
    setNotas(item.notas ?? '')
    setError(null)
    // Histórico completo del ejercicio para la gráfica de progresión
    setCargandoHist(true)
    setHistory([])
    setDayLogs([])
    void (async () => {
      const [sl, edl] = await Promise.all([
        supabase
          .from('set_logs')
          .select('*')
          .eq('exercise_id', item.exercise_id)
          .order('fecha', { ascending: true })
          .order('serie', { ascending: true }),
        supabase
          .from('exercise_day_logs')
          .select('exercise_id, fecha, peso')
          .eq('exercise_id', item.exercise_id),
      ])
      setHistory((sl.data as SetLog[]) ?? [])
      setDayLogs((edl.data as PesoFecha[]) ?? [])
      setCargandoHist(false)
    })()
  }, [item])

  if (!item) return null

  const parsed = videoUrl.trim() ? parseYouTubeUrl(videoUrl) : null
  const videoInvalido = videoUrl.trim() !== '' && !parsed

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    const exUpdate = supabase
      .from('exercises')
      .update({
        nombre: nombre.trim() || item.exercise.nombre,
        grupo_muscular: grupo.trim() || null,
        search_hint_en: hint.trim() || null,
        video_url: parsed ? videoUrl.trim() : null,
      })
      .eq('id', item.exercise_id)
    const rdeUpdate = supabase
      .from('routine_day_exercises')
      .update({
        series: Math.max(1, parseInt(series, 10) || item.series),
        reps: reps.trim() || item.reps,
        peso: peso.trim() === '' ? null : parseFloat(peso.replace(',', '.')),
        descanso_seg: Math.max(0, parseInt(descanso, 10) || item.descanso_seg),
        notas: notas.trim() || null,
      })
      .eq('id', item.id)
    const [a, b] = await Promise.all([exUpdate, rdeUpdate])
    setGuardando(false)
    const err = a.error ?? b.error
    if (err) {
      setError(err.message)
      return
    }
    onChanged()
    onClose()
  }

  const onFoto = async (f: File | undefined) => {
    if (!f || !user) return
    setSubiendoFoto(true)
    setError(null)
    try {
      await uploadExercisePhoto(user.id, item.exercise_id, f)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo la foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const quitarFoto = async () => {
    if (!item.exercise.photo_url) return
    await deleteExercisePhoto(item.exercise_id, item.exercise.photo_url)
    onChanged()
  }

  const quitarDelDia = async () => {
    if (!confirm(`¿Quitar "${item.exercise.nombre}" de este día?`)) return
    await supabase.from('routine_day_exercises').delete().eq('id', item.id)
    onChanged()
    onClose()
  }

  const eliminarEjercicio = async () => {
    if (
      !confirm(
        `¿Eliminar "${item.exercise.nombre}" del catálogo? Se quitará de todos los días y se borrará su historial.`,
      )
    )
      return
    if (item.exercise.photo_url) {
      await deleteExercisePhoto(item.exercise_id, item.exercise.photo_url).catch(() => {})
    }
    await supabase.from('exercises').delete().eq('id', item.exercise_id)
    onChanged()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={item.exercise.nombre}>
      <div className="flex flex-col gap-5 pb-2">
        {/* Media: vídeo (preview inmediata al pegar) → foto → nada */}
        {parsed ? (
          <div>
            <YouTubeFacade videoId={parsed.id} start={parsed.start} title={nombre} />
            <a
              href={videoUrl.trim()}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Abrir en YouTube ↗
            </a>
          </div>
        ) : item.exercise.photo_url ? (
          <ExercisePhoto path={item.exercise.photo_url} alt={nombre} />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">
            Vídeo de YouTube (pega el enlace del botón compartir)
          </label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtu.be/… (soporta t=1m30s)"
            inputMode="url"
            className={`min-h-11 rounded-xl border bg-ink-soft px-4 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent ${
              videoInvalido ? 'border-red-500' : 'border-ink-border'
            }`}
          />
          {videoInvalido && (
            <p className="text-sm text-red-400">
              No parece un enlace de YouTube válido.
            </p>
          )}
          {!parsed && (
            <a
              href={searchUrl(hint.trim() || nombre)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-ink-raised px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:text-accent"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Buscar en YouTube: “{hint.trim() || nombre}”
            </a>
          )}
        </div>

        {/* Foto propia */}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFoto(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={subiendoFoto}
            onClick={() => fileRef.current?.click()}
            className="flex-1"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
              <circle cx="12" cy="14" r="3.5" />
            </svg>
            {subiendoFoto
              ? 'Subiendo…'
              : item.exercise.photo_url
                ? 'Cambiar foto'
                : 'Hacer foto en el gimnasio'}
          </Button>
          {item.exercise.photo_url && (
            <Button type="button" variant="ghost" onClick={() => void quitarFoto()}>
              Quitar foto
            </Button>
          )}
        </div>

        {/* Parámetros del día */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Series" type="number" inputMode="numeric" min={1} value={series} onChange={(e) => setSeries(e.target.value)} />
          <Input label="Reps (texto, ej. 12+12)" value={reps} onChange={(e) => setReps(e.target.value)} />
          <Input label="Peso (kg)" type="text" inputMode="decimal" placeholder="—" value={peso} onChange={(e) => setPeso(e.target.value)} />
          <Input label="Descanso (seg)" type="number" inputMode="numeric" min={0} value={descanso} onChange={(e) => setDescanso(e.target.value)} />
        </div>
        <Input label="Notas del día (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Técnica, sensaciones…" />

        {/* Datos del ejercicio */}
        <details className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-400">
            Editar ficha del ejercicio
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Input label="Grupo muscular" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
            <Input label="Búsqueda sugerida en YouTube (inglés)" value={hint} onChange={(e) => setHint(e.target.value)} />
          </div>
        </details>

        {/* Gráfica de progresión (Recharts cargado lazy) */}
        {cargandoHist ? (
          <div className="flex justify-center rounded-xl border border-ink-border bg-ink-card py-8">
            <Spinner />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex justify-center rounded-xl border border-ink-border bg-ink-card py-8">
                <Spinner />
              </div>
            }
          >
            <ExerciseProgressChart setLogs={history} dayLogs={dayLogs} />
          </Suspense>
        )}

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <Button onClick={() => void guardar()} disabled={guardando || videoInvalido}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
        <div className="flex justify-between pb-2">
          <Button type="button" variant="ghost" onClick={() => void quitarDelDia()}>
            Quitar del día
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void eliminarEjercicio()}
            className="text-red-500 hover:text-red-400"
          >
            Eliminar ejercicio
          </Button>
        </div>
      </div>
    </Modal>
  )
}
