import { describe, expect, it } from 'vitest'
import { sparklineSeries, sparklinePath } from './sparkline'
import type { SetLike, PesoFecha } from './stats'

describe('sparklineSeries', () => {
  it('usa 1RM cuando hay reps en el historico', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-08', reps_hechas: 10, peso_usado: 22 },
    ]
    const r = sparklineSeries(sets, [])
    expect(r.metrica).toBe('oneRM')
    expect(r.values).toHaveLength(2)
    expect(r.values[1]).toBeGreaterThan(r.values[0])
  })

  it('cae a peso max si ningun punto tiene reps (incluye day_logs)', () => {
    const dayLogs: PesoFecha[] = [
      { exercise_id: 'e1', fecha: '2026-06-20', peso: 20 },
      { exercise_id: 'e1', fecha: '2026-06-27', peso: 25 },
    ]
    const r = sparklineSeries([], dayLogs)
    expect(r.metrica).toBe('pesoMax')
    expect(r.values).toEqual([20, 25])
  })

  it('descarta los puntos sin 1RM cuando la metrica es oneRM', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: null, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-08', reps_hechas: 10, peso_usado: 22 },
    ]
    const r = sparklineSeries(sets, [])
    expect(r.metrica).toBe('oneRM')
    expect(r.values).toHaveLength(1)
  })

  it('sin datos devuelve values vacio', () => {
    expect(sparklineSeries([], []).values).toEqual([])
  })
})

describe('sparklinePath', () => {
  it('devuelve cadena vacia con menos de 2 puntos', () => {
    expect(sparklinePath([], 100, 20)).toBe('')
    expect(sparklinePath([5], 100, 20)).toBe('')
  })

  it('mapea el valor mayor a la Y mas pequena (Y invertida)', () => {
    const d = sparklinePath([10, 20], 100, 20, 2)
    expect(d).toBe('M2.00 18.00 L98.00 2.00')
  })

  it('con todos los valores iguales dibuja una linea horizontal centrada', () => {
    const d = sparklinePath([5, 5], 100, 20, 2)
    expect(d).toBe('M2.00 10.00 L98.00 10.00')
  })

  it('genera un comando por punto', () => {
    const d = sparklinePath([1, 2, 3], 100, 20)
    expect(d.match(/[ML]/g)).toHaveLength(3)
  })
})
