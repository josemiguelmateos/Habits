import type { DailyLog } from '../types'

/**
 * Sistema de puntos único (se reutilizará en dashboard y fase social):
 * 1 punto por hábito cumplido (máx. 4) + 1 bonus por día perfecto (4/4) = máx. 5.
 */
export function dailyPoints(log: Partial<DailyLog> | null | undefined): {
  points: number
  habitsDone: number
  perfect: boolean
} {
  if (!log) return { points: 0, habitsDone: 0, perfect: false }
  const habitsDone = [
    log.exercise_done,
    log.diet_done,
    log.sleep_done,
    log.hydration_done,
  ].filter(Boolean).length
  const perfect = habitsDone === 4
  return { points: habitsDone + (perfect ? 1 : 0), habitsDone, perfect }
}
