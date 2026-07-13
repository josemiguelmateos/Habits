import { describe, expect, it } from 'vitest'
import { draftKey, parseDraft } from './workoutDraft'

describe('draftKey', () => {
  it('combina prefijo, userId y fecha', () => {
    expect(draftKey('u1', '2026-07-13')).toBe('habits:workout:u1:2026-07-13')
  })
})

describe('parseDraft', () => {
  it('devuelve null con null', () => {
    expect(parseDraft(null)).toBeNull()
  })

  it('devuelve null con JSON inválido', () => {
    expect(parseDraft('{no-json')).toBeNull()
  })

  it('devuelve null si el JSON no es un objeto', () => {
    expect(parseDraft('5')).toBeNull()
    expect(parseDraft('[]')).toBeNull()
  })

  it('hace round-trip de un borrador válido', () => {
    const d = {
      hechas: { e1: [true, false] },
      pesos: { e1: '20' },
      repsPorSerie: { e1: ['12', '8'] },
    }
    expect(parseDraft(JSON.stringify(d))).toEqual(d)
  })

  it('rellena con {} los sub-campos que falten o no sean objeto', () => {
    expect(parseDraft('{"hechas":{"e1":[true]}}')).toEqual({
      hechas: { e1: [true] },
      pesos: {},
      repsPorSerie: {},
    })
    expect(parseDraft('{"hechas":5,"pesos":"x"}')).toEqual({
      hechas: {},
      pesos: {},
      repsPorSerie: {},
    })
  })
})
