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
