import { describe, expect, it } from 'vitest'
import { addDays, completionPct, computeStreaks } from './streaks'

const HOY = '2026-07-05'

/** Construye un Set de fechas cumplidas a partir de offsets respecto a HOY (0 = hoy). */
function fechas(...offsets: number[]): Set<string> {
  return new Set(offsets.map((o) => addDays(HOY, -o)))
}

describe('computeStreaks', () => {
  it('sin datos devuelve ceros', () => {
    expect(computeStreaks(new Set(), HOY, null)).toEqual({
      current: 0,
      best: 0,
      graceInCurrent: 0,
    })
  })

  it('racha simple de 5 días hasta hoy', () => {
    const done = fechas(0, 1, 2, 3, 4)
    const r = computeStreaks(done, HOY, addDays(HOY, -10))
    expect(r.current).toBe(5)
    expect(r.graceInCurrent).toBe(0)
  })

  it('hoy sin cumplir todavía no rompe la racha (ancla en ayer)', () => {
    const done = fechas(1, 2, 3)
    const r = computeStreaks(done, HOY, addDays(HOY, -10))
    expect(r.current).toBe(3)
  })

  it('un fallo tras 6 cumplidos usa día de gracia y la racha sigue', () => {
    // hoy y ayer cumplidos, antesdeayer fallo, y los 6 previos cumplidos
    const done = fechas(0, 1, 3, 4, 5, 6, 7, 8)
    const r = computeStreaks(done, HOY, addDays(HOY, -20))
    expect(r.current).toBe(9) // 6 + gracia + 2
    expect(r.graceInCurrent).toBe(1)
  })

  it('un fallo con solo 5 cumplidos antes rompe la racha', () => {
    const done = fechas(0, 1, 3, 4, 5, 6, 7) // solo 5 antes del fallo (offset 2)
    const r = computeStreaks(done, HOY, addDays(HOY, -20))
    expect(r.current).toBe(2)
  })

  it('no hay segunda gracia sin 6 cumplidos de por medio', () => {
    // fallo en offset 2 (gracia legítima: 6 previos cumplidos)
    // y fallo en offset 0... anclamos ayer: offsets 1,3,4,5,6,7,8 cumplidos
    // fallo offset 2: sus 6 previos (3..8) cumplidos → gracia
    // pero un segundo fallo dentro de la misma semana rompe
    const done = fechas(1, 3, 4, 5, 6, 7, 8, 10)
    // offset 9 fallo: previos 10..15 → 10 cumplido pero 11..15 no → rompe ahí
    const r = computeStreaks(done, HOY, addDays(HOY, -20))
    expect(r.current).toBe(8) // ayer(1) + gracia(2) + 3..8 = 8
    expect(r.graceInCurrent).toBe(1)
  })

  it('mejor racha histórica con gracia hacia delante', () => {
    // 6 cumplidos, 1 fallo (gracia), 5 cumplidos → 12; luego hueco y 2 sueltos
    const offsets = [19, 18, 17, 16, 15, 14, /* 13 fallo */ 12, 11, 10, 9, 8, /* hueco */ 3, 2]
    const done = fechas(...offsets)
    const r = computeStreaks(done, HOY, addDays(HOY, -25))
    expect(r.best).toBe(12)
  })

  it('la mejor racha nunca es menor que la actual', () => {
    const done = fechas(0, 1, 2)
    const r = computeStreaks(done, HOY, addDays(HOY, -3))
    expect(r.best).toBeGreaterThanOrEqual(r.current)
  })
})

describe('completionPct', () => {
  it('calcula el % sobre la ventana completa', () => {
    const done = fechas(0, 1, 2, 3, 4, 5, 6) // 7 de 7
    expect(completionPct(done, HOY, 7)).toBe(100)
    expect(completionPct(done, HOY, 30)).toBe(Math.round((7 / 30) * 100))
  })

  it('los días sin registrar cuentan como no cumplidos', () => {
    expect(completionPct(fechas(0, 2), HOY, 4)).toBe(50)
  })
})
