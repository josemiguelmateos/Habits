import { supabase } from './supabase'
import rutinaJson from '../data/rutina-inicial.json'

export interface JsonEjercicio {
  nombre: string
  grupo: string
  search_hint_en?: string
  nota?: string
}

export interface JsonItem {
  ejercicio: string
  orden: number
  series: number
  reps: string
  descanso_seg: number
}

export interface JsonDia {
  dia: string
  titulo: string
  items: JsonItem[]
}

export interface JsonCardio {
  dia: string
  duracion_min: number | null
  momento?: string
  tipo?: string
  metodo?: string
  zona_velocidad?: string
}

export interface RutinaJson {
  ejercicios: Record<string, JsonEjercicio>
  rutina: JsonDia[]
  cardio: JsonCardio[]
}

export const WEEKDAY: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7,
}

/**
 * Valida y normaliza una rutina en el formato de rutina-inicial.json.
 * Devuelve un error legible en español si algo no cuadra.
 */
export function validateRutinaJson(
  raw: unknown,
): { ok: true; data: RutinaJson } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'El JSON raíz debe ser un objeto.' }
  }
  const x = raw as Record<string, unknown>

  if (typeof x.ejercicios !== 'object' || x.ejercicios === null) {
    return { ok: false, error: 'Falta el bloque "ejercicios" (objeto con los ejercicios).' }
  }
  const ejercicios: Record<string, JsonEjercicio> = {}
  for (const [key, val] of Object.entries(x.ejercicios as Record<string, unknown>)) {
    const e = val as Record<string, unknown>
    if (typeof e?.nombre !== 'string' || !e.nombre.trim()) {
      return { ok: false, error: `El ejercicio "${key}" no tiene "nombre".` }
    }
    ejercicios[key] = {
      nombre: e.nombre.trim(),
      grupo: typeof e.grupo === 'string' ? e.grupo : '',
      search_hint_en: typeof e.search_hint_en === 'string' ? e.search_hint_en : undefined,
      nota: typeof e.nota === 'string' ? e.nota : undefined,
    }
  }
  if (Object.keys(ejercicios).length === 0) {
    return { ok: false, error: '"ejercicios" está vacío.' }
  }

  if (!Array.isArray(x.rutina)) {
    return { ok: false, error: 'Falta el bloque "rutina" (lista de días).' }
  }
  const rutina: JsonDia[] = []
  const weekdaysVistos = new Set<number>()
  for (const [i, val] of (x.rutina as unknown[]).entries()) {
    const d = val as Record<string, unknown>
    const dia = String(d?.dia ?? '').toLowerCase().trim()
    if (!(dia in WEEKDAY)) {
      return {
        ok: false,
        error: `Día nº${i + 1}: "dia" debe ser lunes…domingo (llegó "${d?.dia}").`,
      }
    }
    if (weekdaysVistos.has(WEEKDAY[dia])) {
      return { ok: false, error: `El día "${dia}" aparece dos veces en "rutina".` }
    }
    weekdaysVistos.add(WEEKDAY[dia])
    if (!Array.isArray(d.items)) {
      return { ok: false, error: `Día "${dia}": falta la lista "items".` }
    }
    const items: JsonItem[] = []
    for (const [j, itVal] of (d.items as unknown[]).entries()) {
      const it = itVal as Record<string, unknown>
      const key = String(it?.ejercicio ?? '')
      if (!(key in ejercicios)) {
        return {
          ok: false,
          error: `Día "${dia}", item nº${j + 1}: el ejercicio "${key}" no existe en "ejercicios".`,
        }
      }
      items.push({
        ejercicio: key,
        orden: Number(it.orden) || j + 1,
        series: Math.max(1, Number(it.series) || 4),
        reps: String(it.reps ?? '10'),
        descanso_seg: Math.max(0, Number(it.descanso_seg) || 60),
      })
    }
    rutina.push({
      dia,
      titulo: String(d.titulo ?? '').trim() || `Entrenamiento ${dia}`,
      items,
    })
  }
  if (rutina.length === 0) {
    return { ok: false, error: '"rutina" está vacía: añade al menos un día.' }
  }

  const cardio: JsonCardio[] = []
  if (Array.isArray(x.cardio)) {
    for (const [i, val] of (x.cardio as unknown[]).entries()) {
      const c = val as Record<string, unknown>
      const dia = String(c?.dia ?? '').toLowerCase().trim()
      if (!(dia in WEEKDAY)) {
        return {
          ok: false,
          error: `Cardio nº${i + 1}: "dia" debe ser lunes…domingo (llegó "${c?.dia}").`,
        }
      }
      cardio.push({
        dia,
        duracion_min: c.duracion_min != null ? Number(c.duracion_min) || null : null,
        momento: typeof c.momento === 'string' ? c.momento : undefined,
        tipo: typeof c.tipo === 'string' ? c.tipo : undefined,
        metodo: typeof c.metodo === 'string' ? c.metodo : undefined,
        zona_velocidad: typeof c.zona_velocidad === 'string' ? c.zona_velocidad : undefined,
      })
    }
  }

  return { ok: true, data: { ejercicios, rutina, cardio } }
}

/** Inserta una rutina completa (ya validada) para el usuario, vía RLS. */
export async function importRoutineData(userId: string, data: RutinaJson): Promise<void> {
  // 1) Catálogo de ejercicios
  const exerciseRows = Object.values(data.ejercicios).map((e) => ({
    user_id: userId,
    nombre: e.nombre,
    grupo_muscular: e.grupo || null,
    search_hint_en: e.search_hint_en ?? null,
    notas_tecnica: e.nota ?? null,
    photo_url: null,
    video_url: null,
  }))
  const { data: inserted, error: exErr } = await supabase
    .from('exercises')
    .insert(exerciseRows)
    .select('id, nombre')
  if (exErr) throw exErr

  // Mapa clave JSON → id insertado. Si hay nombres repetidos en el catálogo,
  // el orden de inserción (idéntico al de exerciseRows) desambigua.
  const keys = Object.keys(data.ejercicios)
  const idByKey = new Map<string, string>(
    keys.map((key, i) => [key, inserted![i].id as string]),
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
  if (data.cardio.length > 0) {
    const cardioRows = data.cardio.map((c) => ({
      user_id: userId,
      weekday: WEEKDAY[c.dia],
      duracion_min: c.duracion_min,
      momento: c.momento ?? null,
      tipo: c.tipo ?? null,
      metodo: c.metodo ?? null,
      zona_velocidad: c.zona_velocidad ?? null,
    }))
    const { error: cardioErr } = await supabase.from('cardio_sessions').insert(cardioRows)
    if (cardioErr) throw cardioErr
  }
}

/** Rutina de ejemplo empaquetada (la de src/data/rutina-inicial.json). */
export async function importInitialRoutine(userId: string): Promise<void> {
  const validated = validateRutinaJson(rutinaJson)
  if (!validated.ok) throw new Error(validated.error)
  await importRoutineData(userId, validated.data)
}
