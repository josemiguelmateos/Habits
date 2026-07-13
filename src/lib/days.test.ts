import { describe, expect, it } from 'vitest'
import { isoWeekNumber, semanaActiva } from './days'

describe('isoWeekNumber', () => {
  it('el 1 de enero de 2026 (jueves) es la semana 1', () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1)
  })

  it('el 4 de enero de 2021 (lunes) es la semana 1', () => {
    expect(isoWeekNumber(new Date(2021, 0, 4))).toBe(1)
  })

  it('el 3 de enero de 2021 (domingo) pertenece a la semana 53 de 2020', () => {
    expect(isoWeekNumber(new Date(2021, 0, 3))).toBe(53)
  })

  it('el 8 de enero de 2026 es la semana 2', () => {
    expect(isoWeekNumber(new Date(2026, 0, 8))).toBe(2)
  })
})

describe('semanaActiva', () => {
  it('con 1 semana (o menos) siempre devuelve 1', () => {
    expect(semanaActiva(1, new Date(2026, 0, 8))).toBe(1)
    expect(semanaActiva(0, new Date(2026, 0, 8))).toBe(1)
  })

  it('rota ((semanaISO-1) % N) + 1', () => {
    expect(semanaActiva(3, new Date(2026, 0, 1))).toBe(1)
    expect(semanaActiva(3, new Date(2026, 0, 8))).toBe(2)
    expect(semanaActiva(3, new Date(2026, 0, 15))).toBe(3)
    expect(semanaActiva(3, new Date(2026, 0, 22))).toBe(1)
  })
})
