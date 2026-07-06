/** Volumen y récords a partir de set_logs (+ pesos del diario del calendario). */

export interface SetLike {
  exercise_id: string
  fecha: string
  reps_hechas: number | null
  peso_usado: number | null
}

/** kg totales movidos: Σ (peso × reps) de los sets con ambos datos. */
export function volumen(sets: SetLike[], desde?: string, hasta?: string): number {
  let total = 0
  for (const s of sets) {
    if (desde && s.fecha < desde) continue
    if (hasta && s.fecha > hasta) continue
    if (s.peso_usado != null && s.reps_hechas != null) {
      total += s.peso_usado * s.reps_hechas
    }
  }
  return Math.round(total)
}

export interface PesoFecha {
  exercise_id: string
  fecha: string
  peso: number | null
}

/** Máximo histórico por ejercicio (para detectar PRs), con su fecha. */
export function maxPorEjercicio(
  registros: PesoFecha[],
): Map<string, { peso: number; fecha: string }> {
  const out = new Map<string, { peso: number; fecha: string }>()
  for (const r of registros) {
    if (r.peso == null) continue
    const prev = out.get(r.exercise_id)
    if (!prev || r.peso > prev.peso || (r.peso === prev.peso && r.fecha < prev.fecha)) {
      if (!prev || r.peso > prev.peso) {
        out.set(r.exercise_id, { peso: r.peso, fecha: r.fecha })
      }
    }
  }
  return out
}

export function formatKg(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1).replace('.0', '')} t`
  return `${kg.toLocaleString('es-ES')} kg`
}
