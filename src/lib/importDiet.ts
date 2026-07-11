import { supabase } from './supabase'
import dietaJson from '../data/dieta-inicial.json'

export interface JsonMealItem {
  nombre: string
  categoria?: string | null
  cantidad?: number | null
  unidad?: string | null
}

export interface JsonMeal {
  dias: number[]
  slot: string
  orden?: number
  descripcion: string
  items?: JsonMealItem[]
}

export interface DietaJson {
  objetivo?: string | null
  kcal?: number | null
  notas?: string | null
  comidas: JsonMeal[]
}

/**
 * Valida una dieta en el formato de dieta-inicial.json.
 * Devuelve un error legible en español si algo no cuadra.
 */
export function validateDietaJson(
  raw: unknown,
): { ok: true; data: DietaJson } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'El JSON raíz debe ser un objeto.' }
  }
  const x = raw as Record<string, unknown>
  if (!Array.isArray(x.comidas)) {
    return { ok: false, error: 'Falta el bloque "comidas" (lista de comidas).' }
  }
  const comidas: JsonMeal[] = []
  for (const [i, val] of (x.comidas as unknown[]).entries()) {
    const m = val as Record<string, unknown>
    if (!Array.isArray(m.dias) || m.dias.length === 0) {
      return {
        ok: false,
        error: `Comida nº${i + 1}: "dias" debe ser una lista con al menos un día (1-7).`,
      }
    }
    const dias = (m.dias as unknown[]).map((d) => Number(d))
    if (dias.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      return {
        ok: false,
        error: `Comida nº${i + 1}: los días deben ser números del 1 (lunes) al 7 (domingo).`,
      }
    }
    if (typeof m.slot !== 'string' || !m.slot.trim()) {
      return { ok: false, error: `Comida nº${i + 1}: falta "slot" (p. ej. "Comida", "Cena").` }
    }
    if (typeof m.descripcion !== 'string' || !m.descripcion.trim()) {
      return { ok: false, error: `Comida nº${i + 1}: falta "descripcion".` }
    }
    const items: JsonMealItem[] = []
    if (Array.isArray(m.items)) {
      for (const [j, itVal] of (m.items as unknown[]).entries()) {
        const it = itVal as Record<string, unknown>
        if (typeof it?.nombre !== 'string' || !it.nombre.trim()) {
          return {
            ok: false,
            error: `Comida nº${i + 1}, item nº${j + 1}: falta "nombre".`,
          }
        }
        const cantidad =
          it.cantidad == null || it.cantidad === '' ? null : Number(it.cantidad)
        if (cantidad != null && Number.isNaN(cantidad)) {
          return {
            ok: false,
            error: `Comida nº${i + 1}, item "${it.nombre}": la cantidad no es un número.`,
          }
        }
        items.push({
          nombre: it.nombre.trim(),
          categoria: typeof it.categoria === 'string' ? it.categoria : null,
          cantidad,
          unidad: typeof it.unidad === 'string' ? it.unidad : null,
        })
      }
    }
    comidas.push({
      dias,
      slot: m.slot.trim(),
      orden: Number(m.orden) || i + 1,
      descripcion: m.descripcion.trim(),
      items,
    })
  }
  if (comidas.length === 0) {
    return { ok: false, error: '"comidas" está vacío: añade al menos una comida.' }
  }
  return {
    ok: true,
    data: {
      objetivo: typeof x.objetivo === 'string' ? x.objetivo : null,
      kcal: x.kcal != null ? Number(x.kcal) || null : null,
      notas: typeof x.notas === 'string' ? x.notas : null,
      comidas,
    },
  }
}

/** Inserta una dieta completa (ya validada) para el usuario, vía RLS. */
export async function importDietData(userId: string, data: DietaJson): Promise<void> {
  // 1) Meta
  const { error: metaErr } = await supabase.from('diet_meta').upsert({
    user_id: userId,
    objetivo: data.objetivo,
    kcal: data.kcal,
    notas: data.notas,
  })
  if (metaErr) throw metaErr

  // 2) Comidas
  const mealRows = data.comidas.map((c) => ({
    user_id: userId,
    dias: c.dias,
    slot: c.slot,
    orden: c.orden ?? 0,
    descripcion: c.descripcion,
  }))
  const { data: inserted, error: mealErr } = await supabase
    .from('diet_meals')
    .insert(mealRows)
    .select('id')
  if (mealErr) throw mealErr

  // 3) Items (el orden de inserción coincide con data.comidas)
  const itemRows = data.comidas.flatMap((c, i) =>
    (c.items ?? []).map((it) => ({
      user_id: userId,
      meal_id: inserted![i].id as string,
      nombre: it.nombre,
      categoria: it.categoria ?? null,
      cantidad: it.cantidad ?? null,
      unidad: it.unidad ?? null,
    })),
  )
  if (itemRows.length > 0) {
    const { error: itemErr } = await supabase.from('diet_meal_items').insert(itemRows)
    if (itemErr) throw itemErr
  }
}

/** Dieta de ejemplo empaquetada (la de src/data/dieta-inicial.json). */
export async function importInitialDiet(userId: string): Promise<void> {
  const validated = validateDietaJson(dietaJson)
  if (!validated.ok) throw new Error(validated.error)
  await importDietData(userId, validated.data)
}
