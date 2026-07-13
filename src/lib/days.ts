export const WEEKDAY_NAMES = [
  '',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const

/** 1=lunes … 7=domingo (ISO), a partir de un Date local. */
export function isoWeekday(d: Date = new Date()): number {
  return ((d.getDay() + 6) % 7) + 1
}

/** Fecha local YYYY-MM-DD (sin líos de zona horaria con toISOString). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Número de semana ISO 8601 (1-53) a partir de una fecha local. */
export function isoWeekNumber(d: Date = new Date()): number {
  // Trabaja en UTC con la fecha local (año/mes/día) para evitar líos de zona.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = (date.getUTCDay() + 6) % 7 // 0=lunes … 6=domingo
  date.setUTCDate(date.getUTCDate() - day + 3) // jueves de esta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** Semana del ciclo (1..semanas) según la semana ISO. Con semanas<=1 → 1. */
export function semanaActiva(semanas: number, d: Date = new Date()): number {
  if (semanas <= 1) return 1
  return ((isoWeekNumber(d) - 1) % semanas) + 1
}
