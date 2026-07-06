export interface LevelInfo {
  level: number
  name: string
  xp: number
  /** XP acumulada dentro del nivel actual */
  intoLevel: number
  /** XP necesaria para pasar al siguiente nivel */
  forNext: number
}

const NOMBRES = [
  'Novato',
  'Constante',
  'Disciplinado',
  'Comprometido',
  'Imparable',
  'Veterano',
  'Máquina',
  'Titán',
  'Leyenda',
  'Élite',
]

/** Coste de subir del nivel n al n+1. Crece linealmente: 50, 70, 90… */
export function costForLevel(n: number): number {
  return 30 + 20 * n
}

/**
 * XP = puntos diarios acumulados de toda la vida (máx. 5/día).
 * El nivel nunca baja: es el contrapeso permanente a las rachas.
 */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  while (rest >= costForLevel(level)) {
    rest -= costForLevel(level)
    level++
  }
  return {
    level,
    name: NOMBRES[Math.min(level, NOMBRES.length) - 1],
    xp: Math.max(0, Math.floor(xp)),
    intoLevel: rest,
    forNext: costForLevel(level),
  }
}
