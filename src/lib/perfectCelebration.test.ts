import { describe, expect, it } from 'vitest'
import { celebracionKey } from './perfectCelebration'

describe('celebracionKey', () => {
  it('combina el prefijo con la fecha', () => {
    expect(celebracionKey('2026-07-13')).toBe('habits:perfect-cel:2026-07-13')
  })
})
