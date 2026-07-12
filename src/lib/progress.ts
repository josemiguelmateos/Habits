/** Progresión por ejercicio: 1RM (Epley), volumen y peso máx por sesión + PRs. */

import type { SetLike, PesoFecha } from './stats'

/** 1RM estimado (Epley): peso × (1 + reps/30). */
export function epley(peso: number, reps: number): number {
  return peso * (1 + reps / 30)
}

export interface ProgressPoint {
  fecha: string
  /** max(peso_usado) del día, fusionando set_logs + exercise_day_logs. */
  pesoMax: number | null
  /** mejor 1RM estimado del día (redondeado a 1 decimal); null sin reps. */
  oneRM: number | null
  /** Σ (peso × reps) del día (kg enteros); null sin reps. */
  volumen: number | null
  /** serie que da el mejor 1RM del día; null sin reps. */
  mejorSet: { peso: number; reps: number } | null
}

export type ProgressPointPR = ProgressPoint & { isPR: boolean }

/**
 * Serie temporal por ejercicio, ordenada por fecha ascendente. Agrupa `set_logs`
 * por fecha para 1RM/volumen/pesoMax y fusiona `exercise_day_logs` solo en pesoMax
 * (el diario del calendario no tiene reps).
 */
export function buildProgressSeries(
  setLogs: SetLike[],
  dayLogs: PesoFecha[],
): ProgressPoint[] {
  const porFecha = new Map<string, SetLike[]>()
  for (const s of setLogs) {
    const arr = porFecha.get(s.fecha) ?? []
    arr.push(s)
    porFecha.set(s.fecha, arr)
  }

  // pesoMax por fecha proveniente del diario del calendario
  const pesoDiario = new Map<string, number>()
  for (const d of dayLogs) {
    if (d.peso == null) continue
    pesoDiario.set(d.fecha, Math.max(pesoDiario.get(d.fecha) ?? -Infinity, d.peso))
    if (!porFecha.has(d.fecha)) porFecha.set(d.fecha, [])
  }

  const puntos: ProgressPoint[] = []
  for (const [fecha, sets] of porFecha) {
    let pesoMax: number | null = pesoDiario.get(fecha) ?? null
    let mejorRM = -Infinity
    let mejorSet: { peso: number; reps: number } | null = null
    let volumen: number | null = null

    for (const s of sets) {
      if (s.peso_usado != null) {
        pesoMax = pesoMax == null ? s.peso_usado : Math.max(pesoMax, s.peso_usado)
      }
      if (s.peso_usado != null && s.reps_hechas != null) {
        volumen = (volumen ?? 0) + s.peso_usado * s.reps_hechas
        const rm = epley(s.peso_usado, s.reps_hechas)
        if (rm > mejorRM) {
          mejorRM = rm
          mejorSet = { peso: s.peso_usado, reps: s.reps_hechas }
        }
      }
    }

    puntos.push({
      fecha,
      pesoMax,
      oneRM: mejorSet ? Math.round(mejorRM * 10) / 10 : null,
      volumen: volumen == null ? null : Math.round(volumen),
      mejorSet,
    })
  }

  return puntos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
}

/**
 * Marca cada punto como PR si su valor de `metrica` supera estrictamente el
 * máximo de TODOS los puntos anteriores. El primer punto con dato nunca es PR
 * (es la línea base). Los puntos con valor null para esa métrica se ignoran.
 */
export function marcarPRs(
  puntos: ProgressPoint[],
  metrica: 'pesoMax' | 'oneRM' | 'volumen',
): ProgressPointPR[] {
  let maxPrevio = -Infinity
  return puntos.map((p) => {
    const v = p[metrica]
    if (v == null) return { ...p, isPR: false }
    const isPR = maxPrevio !== -Infinity && v > maxPrevio
    if (v > maxPrevio) maxPrevio = v
    return { ...p, isPR }
  })
}
