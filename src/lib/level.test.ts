import { describe, expect, it } from 'vitest'
import { costForLevel, levelFromXp } from './level'

describe('levelFromXp', () => {
  it('empieza en nivel 1 (Novato) con 0 XP', () => {
    const l = levelFromXp(0)
    expect(l.level).toBe(1)
    expect(l.name).toBe('Novato')
    expect(l.intoLevel).toBe(0)
    expect(l.forNext).toBe(50)
  })

  it('sube a nivel 2 justo en el umbral', () => {
    expect(levelFromXp(49).level).toBe(1)
    const l = levelFromXp(50)
    expect(l.level).toBe(2)
    expect(l.name).toBe('Constante')
    expect(l.intoLevel).toBe(0)
    expect(l.forNext).toBe(70)
  })

  it('acumula el resto dentro del nivel', () => {
    const l = levelFromXp(80) // 50 para L2, quedan 30 de 70
    expect(l.level).toBe(2)
    expect(l.intoLevel).toBe(30)
  })

  it('el coste crece 20 por nivel', () => {
    expect(costForLevel(1)).toBe(50)
    expect(costForLevel(2)).toBe(70)
    expect(costForLevel(5)).toBe(130)
  })

  it('más allá del nivel 10 mantiene el nombre Élite', () => {
    // Suma de costes L1..L11 = 50+70+...+250 = 1650
    const l = levelFromXp(2000)
    expect(l.level).toBeGreaterThan(10)
    expect(l.name).toBe('Élite')
  })

  it('tolera XP negativa o decimal', () => {
    expect(levelFromXp(-5).level).toBe(1)
    expect(levelFromXp(50.9).level).toBe(2)
  })
})
