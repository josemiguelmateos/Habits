/** Última sesión registrada por ejercicio (reps por serie + peso del día). */

import type { SetLike } from './stats'

export interface SetConSerie extends SetLike {
  serie: number
}

export interface UltimaSesion {
  fecha: string
  /** máx peso_usado del día; null si ninguna serie llevó peso */
  peso: number | null
  /** reps por serie (índice = serie - 1); huecos → null */
  reps: (number | null)[]
}

function sesionDeFecha(rows: SetConSerie[], fecha: string): UltimaSesion {
  const delDia = rows.filter((r) => r.fecha === fecha)
  let peso: number | null = null
  const reps: (number | null)[] = []
  for (const r of delDia) {
    if (r.peso_usado != null) peso = peso == null ? r.peso_usado : Math.max(peso, r.peso_usado)
    reps[r.serie - 1] = r.reps_hechas
  }
  // los huecos de Array quedan undefined → normaliza a null
  for (let i = 0; i < reps.length; i++) if (reps[i] === undefined) reps[i] = null
  return { fecha, peso, reps }
}

/** Sesión más reciente de cada ejercicio. */
export function ultimaSesionPorEjercicio(rows: SetConSerie[]): Map<string, UltimaSesion> {
  const porEx = new Map<string, SetConSerie[]>()
  for (const r of rows) {
    const a = porEx.get(r.exercise_id) ?? []
    a.push(r)
    porEx.set(r.exercise_id, a)
  }
  const out = new Map<string, UltimaSesion>()
  for (const [ex, exRows] of porEx) {
    const ultimaFecha = exRows.reduce((m, r) => (r.fecha > m ? r.fecha : m), '')
    out.set(ex, sesionDeFecha(exRows, ultimaFecha))
  }
  return out
}

/** "12·12·8·8 × 20 kg" · sin peso → solo reps (huecos como –) · sin reps → "20 kg". */
export function resumenUltimaSesion(s: UltimaSesion): string {
  const conReps = s.reps.some((r) => r != null)
  const repsStr = conReps ? s.reps.map((r) => (r == null ? '–' : String(r))).join('·') : ''
  if (conReps && s.peso != null) return `${repsStr} × ${s.peso} kg`
  if (conReps) return repsStr
  return s.peso != null ? `${s.peso} kg` : ''
}

/** Hasta `max` sesiones de un ejercicio, la más reciente primero, con fecha. */
export function resumenesUltimasSesiones(rows: SetConSerie[], max = 3): string[] {
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort().reverse().slice(0, max)
  return fechas.map((f) => `${resumenUltimaSesion(sesionDeFecha(rows, f))} (${f})`)
}
