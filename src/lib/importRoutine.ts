import { supabase } from './supabase'
import rutinaJson from '../data/rutina-inicial.json'

interface JsonEjercicio {
  nombre: string
  grupo: string
  search_hint_en: string
  nota?: string
}

interface JsonItem {
  ejercicio: string
  orden: number
  series: number
  reps: string
  descanso_seg: number
}

interface JsonDia {
  dia: string
  titulo: string
  items: JsonItem[]
}

interface JsonCardio {
  dia: string
  duracion_min: number
  momento: string
  tipo: string
  metodo: string
  zona_velocidad: string
}

interface RutinaJson {
  objetivo: string
  mes: string
  ejercicios: Record<string, JsonEjercicio>
  rutina: JsonDia[]
  cardio: JsonCardio[]
  descanso_total: string[]
}

const data = rutinaJson as unknown as RutinaJson

const WEEKDAY: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

/**
 * Inserta la rutina inicial completa para el usuario logueado vía cliente
 * Supabase (compatible con RLS). Todos los ejercicios arrancan sin media
 * y con la carga (KGS) vacía: se rellenan desde la app.
 */
export async function importInitialRoutine(userId: string): Promise<void> {
  // 1) Catálogo de ejercicios
  const exerciseRows = Object.values(data.ejercicios).map((e) => ({
    user_id: userId,
    nombre: e.nombre,
    grupo_muscular: e.grupo,
    search_hint_en: e.search_hint_en,
    notas_tecnica: e.nota ?? null,
    photo_url: null,
    video_url: null,
  }))
  const { data: inserted, error: exErr } = await supabase
    .from('exercises')
    .insert(exerciseRows)
    .select('id, nombre')
  if (exErr) throw exErr

  // Mapa clave JSON → id insertado (los nombres del catálogo son únicos)
  const idByNombre = new Map(inserted!.map((r) => [r.nombre as string, r.id as string]))
  const idByKey = new Map(
    Object.entries(data.ejercicios).map(([key, e]) => [key, idByNombre.get(e.nombre)!]),
  )

  // 2) Días de rutina
  const dayRows = data.rutina.map((d) => ({
    user_id: userId,
    weekday: WEEKDAY[d.dia],
    titulo: d.titulo,
  }))
  const { data: insertedDays, error: dayErr } = await supabase
    .from('routine_days')
    .insert(dayRows)
    .select('id, weekday')
  if (dayErr) throw dayErr
  const dayIdByWeekday = new Map(
    insertedDays!.map((r) => [r.weekday as number, r.id as string]),
  )

  // 3) Asignación ejercicio-día
  const itemRows = data.rutina.flatMap((d) =>
    d.items.map((it) => ({
      user_id: userId,
      routine_day_id: dayIdByWeekday.get(WEEKDAY[d.dia])!,
      exercise_id: idByKey.get(it.ejercicio)!,
      orden: it.orden,
      series: it.series,
      reps: it.reps,
      peso: null,
      descanso_seg: it.descanso_seg,
    })),
  )
  const { error: itemErr } = await supabase.from('routine_day_exercises').insert(itemRows)
  if (itemErr) throw itemErr

  // 4) Cardio
  const cardioRows = data.cardio.map((c) => ({
    user_id: userId,
    weekday: WEEKDAY[c.dia],
    duracion_min: c.duracion_min,
    momento: c.momento,
    tipo: c.tipo,
    metodo: c.metodo,
    zona_velocidad: c.zona_velocidad,
  }))
  const { error: cardioErr } = await supabase.from('cardio_sessions').insert(cardioRows)
  if (cardioErr) throw cardioErr
}
