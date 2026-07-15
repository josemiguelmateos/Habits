import { describe, expect, it } from 'vitest'
import {
  ultimaSesionPorEjercicio,
  resumenUltimaSesion,
  resumenesUltimasSesiones,
  type SetConSerie,
} from './lastSession'

const row = (
  fecha: string,
  serie: number,
  reps: number | null,
  peso: number | null,
  ex = 'e1',
): SetConSerie => ({ exercise_id: ex, fecha, serie, reps_hechas: reps, peso_usado: peso })

describe('ultimaSesionPorEjercicio', () => {
  it('devuelve la sesión de la fecha más reciente, con reps por serie y peso máx del día', () => {
    const rows = [
      row('2026-07-06', 1, 12, 20),
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 2, 12, 22),
      row('2026-07-13', 3, 8, 20),
    ]
    const m = ultimaSesionPorEjercicio(rows)
    const s = m.get('e1')!
    expect(s.fecha).toBe('2026-07-13')
    expect(s.peso).toBe(22)
    expect(s.reps).toEqual([12, 12, 8])
  })

  it('deja huecos null en las series que faltan', () => {
    const m = ultimaSesionPorEjercicio([
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 3, 8, 20),
    ])
    expect(m.get('e1')!.reps).toEqual([12, null, 8])
  })

  it('separa por ejercicio', () => {
    const m = ultimaSesionPorEjercicio([
      row('2026-07-13', 1, 12, 20, 'e1'),
      row('2026-07-10', 1, 10, 30, 'e2'),
    ])
    expect(m.get('e1')!.fecha).toBe('2026-07-13')
    expect(m.get('e2')!.fecha).toBe('2026-07-10')
  })

  it('sin peso registrado, peso es null', () => {
    const m = ultimaSesionPorEjercicio([row('2026-07-13', 1, 12, null)])
    expect(m.get('e1')!.peso).toBeNull()
  })
})

describe('resumenUltimaSesion', () => {
  it('formatea reps y peso', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: 20, reps: [12, 12, 8, 8] }),
    ).toBe('12·12·8·8 × 20 kg')
  })

  it('sin peso muestra solo reps; huecos como guion', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: null, reps: [12, null, 8] }),
    ).toBe('12·–·8')
  })

  it('sin reps (todas null) muestra solo el peso', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: 20, reps: [null, null] }),
    ).toBe('20 kg')
  })
})

describe('resumenesUltimasSesiones', () => {
  it('devuelve hasta N sesiones, la más reciente primero, con fecha', () => {
    const rows = [
      row('2026-07-01', 1, 12, 18),
      row('2026-07-06', 1, 12, 20),
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 2, 8, 20),
    ]
    expect(resumenesUltimasSesiones(rows, 2)).toEqual([
      '12·8 × 20 kg (2026-07-13)',
      '12 × 20 kg (2026-07-06)',
    ])
  })
})
