/** Sparkline de progresion: elige valores (1RM o peso) y genera el path SVG. */

import { buildProgressSeries } from './progress'
import type { SetLike, PesoFecha } from './stats'

/** 1RM si algun punto tiene reps; si no, peso max. Valores en orden cronologico. */
export function sparklineSeries(
  setLogs: SetLike[],
  dayLogs: PesoFecha[],
): { values: number[]; metrica: 'oneRM' | 'pesoMax' } {
  const serie = buildProgressSeries(setLogs, dayLogs)
  const conRM = serie.filter((p) => p.oneRM != null)
  if (conRM.length > 0) {
    return { values: conRM.map((p) => p.oneRM as number), metrica: 'oneRM' }
  }
  return {
    values: serie.filter((p) => p.pesoMax != null).map((p) => p.pesoMax as number),
    metrica: 'pesoMax',
  }
}

/** `d` de un sparkline escalado a width x height (Y invertida). '' si <2 puntos. */
export function sparklinePath(
  values: number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const w = width - pad * 2
  const h = height - pad * 2
  const stepX = w / (values.length - 1)
  const x = (i: number) => pad + i * stepX
  const y = (v: number) =>
    max === min ? pad + h / 2 : pad + h - ((v - min) / (max - min)) * h
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(' ')
}
