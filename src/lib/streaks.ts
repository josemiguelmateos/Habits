import { localDateStr } from './days'

export interface StreakResult {
  current: number
  best: number
  /** días de gracia incluidos en la racha actual */
  graceInCurrent: number
}

export function addDays(fecha: string, delta: number): string {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return localDateStr(d)
}

/**
 * Rachas con "día de gracia": un único día fallado NO rompe la racha si los
 * 6 días anteriores están cumplidos. El límite de 1 gracia por semana se
 * auto-impone: tras una gracia hacen falta 6 cumplidos seguidos para otra.
 *
 * - `done`: fechas (YYYY-MM-DD) en las que el hábito se cumplió.
 * - La racha actual ancla en hoy si ya está cumplido, si no en ayer
 *   (el día en curso nunca rompe la racha).
 */
export function computeStreaks(
  done: Set<string>,
  today: string,
  earliest: string | null,
): StreakResult {
  if (!earliest || done.size === 0) return { current: 0, best: 0, graceInCurrent: 0 }

  const prev6Done = (d: string): boolean => {
    for (let i = 1; i <= 6; i++) {
      if (!done.has(addDays(d, -i))) return false
    }
    return true
  }

  // Racha actual: hacia atrás desde hoy/ayer
  let current = 0
  let graceInCurrent = 0
  let d = done.has(today) ? today : addDays(today, -1)
  while (d >= earliest) {
    if (done.has(d)) {
      current++
    } else if (prev6Done(d)) {
      current++
      graceInCurrent++
    } else {
      break
    }
    d = addDays(d, -1)
  }

  // Mejor racha: hacia delante por todo el histórico
  let best = 0
  let cur = 0
  let sinceFail = 0
  for (let f = earliest; f <= today; f = addDays(f, 1)) {
    if (done.has(f)) {
      cur++
      sinceFail++
    } else if (sinceFail >= 6) {
      cur++ // día de gracia
      sinceFail = 0
    } else {
      cur = 0
      sinceFail = 0
    }
    if (cur > best) best = cur
  }

  return { current, best: Math.max(best, current), graceInCurrent }
}

/** % de cumplimiento en los últimos N días (los días sin registro cuentan como no cumplidos). */
export function completionPct(done: Set<string>, today: string, n: number): number {
  let count = 0
  for (let i = 0; i < n; i++) {
    if (done.has(addDays(today, -i))) count++
  }
  return Math.round((count / n) * 100)
}
