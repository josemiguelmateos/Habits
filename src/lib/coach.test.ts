import { describe, expect, it } from 'vitest'
import {
  analizarProgresion,
  sesionesDesdeLogs,
  sugerenciaHabito,
  sugerenciaProgresion,
  sugerenciaSueno,
} from './coach'
import type { SetConSerie } from './lastSession'

describe('sugerenciaProgresion', () => {
  it('sugiere subir tras 2 sesiones cumpliendo con el mismo peso', () => {
    const s = sugerenciaProgresion('Press banca', [
      { fecha: '2026-07-04', peso: 40, repsOk: true },
      { fecha: '2026-07-01', peso: 40, repsOk: true },
    ])
    expect(s).toContain('42.5 kg')
    expect(s).toContain('Press banca')
  })

  it('no sugiere nada si la última sesión no cumplió las reps', () => {
    expect(
      sugerenciaProgresion('Press banca', [
        { fecha: '2026-07-04', peso: 40, repsOk: false },
        { fecha: '2026-07-01', peso: 40, repsOk: true },
      ]),
    ).toBeNull()
  })

  it('no sugiere nada si acaba de cambiar el peso', () => {
    expect(
      sugerenciaProgresion('Press banca', [
        { fecha: '2026-07-04', peso: 42.5, repsOk: true },
        { fecha: '2026-07-01', peso: 40, repsOk: true },
      ]),
    ).toBeNull()
  })

  it('detecta estancamiento de 4+ sesiones sin cumplir y sugiere bajar', () => {
    const s = sugerenciaProgresion('Scott', [
      { fecha: '2026-07-04', peso: 30, repsOk: false },
      { fecha: '2026-07-01', peso: 30, repsOk: false },
      { fecha: '2026-06-27', peso: 30, repsOk: true },
      { fecha: '2026-06-24', peso: 30, repsOk: false },
    ])
    expect(s).toContain('Baja 2.5 kg')
  })

  it('con una sola sesión no hay sugerencia', () => {
    expect(
      sugerenciaProgresion('Scott', [{ fecha: '2026-07-04', peso: 30, repsOk: true }]),
    ).toBeNull()
  })
})

describe('sugerenciaHabito', () => {
  it('señala el hábito más flojo por debajo del umbral', () => {
    const s = sugerenciaHabito([
      { nombre: 'Dieta', pct: 40 },
      { nombre: 'Sueño', pct: 80 },
    ])
    expect(s).toContain('dieta')
    expect(s).toContain('40%')
  })

  it('calla si todos van bien', () => {
    expect(
      sugerenciaHabito([
        { nombre: 'Dieta', pct: 90 },
        { nombre: 'Sueño', pct: 75 },
      ]),
    ).toBeNull()
  })
})

describe('sugerenciaSueno', () => {
  it('avisa si la media queda por debajo del objetivo', () => {
    const s = sugerenciaSueno([6, 6.5, 6, 7, 6], 7)
    expect(s).toContain('6.3 h')
  })

  it('calla con pocas noches o media suficiente', () => {
    expect(sugerenciaSueno([6, 6], 7)).toBeNull()
    expect(sugerenciaSueno([7, 7, 7, 7, 7], 7)).toBeNull()
  })
})

describe('analizarProgresion', () => {
  it('estructura la subida tras 2 sesiones cumpliendo al mismo peso', () => {
    const r = analizarProgresion([
      { fecha: '2026-07-13', peso: 20, repsOk: true },
      { fecha: '2026-07-06', peso: 20, repsOk: true },
    ])
    expect(r).toEqual({ tipo: 'subir', peso: 22.5, sesiones: 2 })
  })

  it('estructura la bajada tras 4+ sesiones estancado', () => {
    const r = analizarProgresion([
      { fecha: '2026-07-13', peso: 30, repsOk: false },
      { fecha: '2026-07-10', peso: 30, repsOk: false },
      { fecha: '2026-07-06', peso: 30, repsOk: true },
      { fecha: '2026-07-03', peso: 30, repsOk: false },
    ])
    expect(r).toEqual({ tipo: 'bajar', peso: 27.5, sesiones: 4 })
  })

  it('null si no toca cambiar', () => {
    expect(
      analizarProgresion([
        { fecha: '2026-07-13', peso: 22.5, repsOk: true },
        { fecha: '2026-07-06', peso: 20, repsOk: true },
      ]),
    ).toBeNull()
  })
})

describe('sesionesDesdeLogs', () => {
  const log = (fecha: string, serie: number, reps: number | null, peso: number | null): SetConSerie =>
    ({ exercise_id: 'e1', fecha, serie, reps_hechas: reps, peso_usado: peso })

  it('agrupa por fecha (reciente primero) con peso max y repsOk', () => {
    const s = sesionesDesdeLogs(
      [
        log('2026-07-06', 1, 12, 20), log('2026-07-06', 2, 12, 20),
        log('2026-07-13', 1, 12, 22), log('2026-07-13', 2, 12, 22),
      ],
      2, // objetivo series
      12, // objetivo reps
    )
    expect(s).toEqual([
      { fecha: '2026-07-13', peso: 22, repsOk: true },
      { fecha: '2026-07-06', peso: 20, repsOk: true },
    ])
  })

  it('repsOk falso si faltan series, si alguna rep queda corta o es null', () => {
    const pocas = sesionesDesdeLogs([log('2026-07-13', 1, 12, 20)], 2, 12)
    expect(pocas[0].repsOk).toBe(false)
    const cortas = sesionesDesdeLogs(
      [log('2026-07-13', 1, 12, 20), log('2026-07-13', 2, 8, 20)],
      2, 12,
    )
    expect(cortas[0].repsOk).toBe(false)
    const nulas = sesionesDesdeLogs(
      [log('2026-07-13', 1, 12, 20), log('2026-07-13', 2, null, 20)],
      2, 12,
    )
    expect(nulas[0].repsOk).toBe(false)
  })

  it('descarta fechas sin peso registrado (no comparables)', () => {
    const s = sesionesDesdeLogs([log('2026-07-13', 1, 12, null)], 1, 12)
    expect(s).toEqual([])
  })
})
