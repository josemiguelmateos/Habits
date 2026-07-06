import { describe, expect, it } from 'vitest'
import { sugerenciaHabito, sugerenciaProgresion, sugerenciaSueno } from './coach'

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
