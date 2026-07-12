import { describe, expect, it } from 'vitest'
import { epley, buildProgressSeries, marcarPRs } from './progress'
import type { SetLike, PesoFecha } from './stats'

describe('epley', () => {
  it('estima el 1RM con la fórmula peso × (1 + reps/30)', () => {
    expect(epley(22, 8)).toBeCloseTo(27.8667, 3)
  })

  it('a 1 rep el 1RM es prácticamente el peso levantado', () => {
    expect(epley(100, 1)).toBeCloseTo(103.333, 2)
  })
})

describe('buildProgressSeries', () => {
  it('agrupa set_logs por fecha y calcula pesoMax, oneRM y volumen', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
    ]
    const serie = buildProgressSeries(sets, [])
    expect(serie).toHaveLength(1)
    expect(serie[0].fecha).toBe('2026-07-01')
    expect(serie[0].pesoMax).toBe(22)
    expect(serie[0].oneRM).toBeCloseTo(27.9, 1)
    expect(serie[0].volumen).toBe(352) // 22*8 + 22*8
    expect(serie[0].mejorSet).toEqual({ peso: 22, reps: 8 })
  })

  it('ordena los puntos por fecha ascendente', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-10', reps_hechas: 12, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
    ]
    const serie = buildProgressSeries(sets, [])
    expect(serie.map((p) => p.fecha)).toEqual(['2026-07-01', '2026-07-10'])
  })

  it('mejorSet y oneRM salen de la serie con mejor 1RM del día', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 }, // 1RM 27.87
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 6, peso_usado: 24 }, // 1RM 28.8
    ]
    const serie = buildProgressSeries(sets, [])
    expect(serie[0].pesoMax).toBe(24)
    expect(serie[0].oneRM).toBeCloseTo(28.8, 1)
    expect(serie[0].mejorSet).toEqual({ peso: 24, reps: 6 })
    expect(serie[0].volumen).toBe(320) // 22*8 + 24*6
  })

  it('fusiona exercise_day_logs solo en pesoMax; oneRM y volumen quedan null sin reps', () => {
    const dayLogs: PesoFecha[] = [{ exercise_id: 'e1', fecha: '2026-06-20', peso: 20 }]
    const serie = buildProgressSeries([], dayLogs)
    expect(serie).toHaveLength(1)
    expect(serie[0].pesoMax).toBe(20)
    expect(serie[0].oneRM).toBeNull()
    expect(serie[0].volumen).toBeNull()
    expect(serie[0].mejorSet).toBeNull()
  })

  it('el day_log eleva el pesoMax de un día que también tiene set_logs', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
    ]
    const dayLogs: PesoFecha[] = [{ exercise_id: 'e1', fecha: '2026-07-01', peso: 25 }]
    const serie = buildProgressSeries(sets, dayLogs)
    expect(serie).toHaveLength(1)
    expect(serie[0].pesoMax).toBe(25)
    expect(serie[0].oneRM).toBeCloseTo(27.9, 1) // el 1RM sigue viniendo del set (22×8)
  })

  it('deja oneRM/volumen null si el día no tiene ninguna serie con reps y peso', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: null, peso_usado: 22 },
    ]
    const serie = buildProgressSeries(sets, [])
    expect(serie[0].pesoMax).toBe(22)
    expect(serie[0].oneRM).toBeNull()
    expect(serie[0].volumen).toBeNull()
    expect(serie[0].mejorSet).toBeNull()
  })
})

describe('marcarPRs', () => {
  const puntos = [
    { fecha: '2026-07-01', pesoMax: 22, oneRM: 27.9, volumen: 176, mejorSet: { peso: 22, reps: 8 } },
    { fecha: '2026-07-08', pesoMax: 22, oneRM: 29.3, volumen: 220, mejorSet: { peso: 22, reps: 10 } },
    { fecha: '2026-07-15', pesoMax: 22, oneRM: 30.8, volumen: 264, mejorSet: { peso: 22, reps: 12 } },
  ]

  it('marca PR cuando el valor supera estrictamente el máximo previo (1RM que sube)', () => {
    const out = marcarPRs(puntos, 'oneRM')
    expect(out.map((p) => p.isPR)).toEqual([false, true, true])
  })

  it('el primer punto nunca es PR (es la línea base)', () => {
    expect(marcarPRs(puntos, 'volumen')[0].isPR).toBe(false)
  })

  it('un valor igual al máximo previo no es PR (peso máx plano)', () => {
    const out = marcarPRs(puntos, 'pesoMax')
    expect(out.map((p) => p.isPR)).toEqual([false, false, false])
  })

  it('ignora los puntos con valor null para la métrica y no rompe la línea base', () => {
    const conNull = [
      { fecha: '2026-07-01', pesoMax: 22, oneRM: null, volumen: null, mejorSet: null },
      { fecha: '2026-07-08', pesoMax: 24, oneRM: 30, volumen: 200, mejorSet: { peso: 24, reps: 8 } },
      { fecha: '2026-07-15', pesoMax: 24, oneRM: 31, volumen: 210, mejorSet: { peso: 24, reps: 9 } },
    ]
    const out = marcarPRs(conNull, 'oneRM')
    // el primer punto con dato real es línea base (no PR); el siguiente que lo supera sí
    expect(out.map((p) => p.isPR)).toEqual([false, false, true])
  })
})
