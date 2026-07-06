/**
 * Coach de recomendaciones: reglas calculadas sobre tus datos reales
 * (sin IA externa, sin coste, sin latencia). Devuelve sugerencias
 * accionables, no frases genéricas.
 */

export interface SesionPeso {
  fecha: string
  /** peso máximo usado ese día */
  peso: number
  /** true si las reps hechas llegaron al objetivo */
  repsOk: boolean
}

/**
 * Doble progresión: si las 2 últimas sesiones de un ejercicio fueron con el
 * mismo peso cumpliendo reps, toca subir. Si lleva 4+ sesiones estancado en
 * el mismo peso sin cumplir, sugiere bajar un punto y reconstruir.
 */
export function sugerenciaProgresion(
  nombre: string,
  sesiones: SesionPeso[], // ordenadas de más reciente a más antigua
  paso = 2.5,
): string | null {
  if (sesiones.length < 2) return null
  const [a, b] = sesiones
  if (a.peso === b.peso && a.repsOk && b.repsOk) {
    return `${nombre}: 2 sesiones cumpliendo reps con ${a.peso} kg. Prueba ${
      Math.round((a.peso + paso) * 100) / 100
    } kg.`
  }
  const mismoPeso = sesiones.filter((s) => s.peso === a.peso)
  if (mismoPeso.length >= 4 && mismoPeso.slice(0, 2).every((s) => !s.repsOk)) {
    return `${nombre}: ${mismoPeso.length} sesiones con ${a.peso} kg sin cerrar las reps. Baja ${paso} kg y reconstruye.`
  }
  return null
}

/** Hábito más flojo de una ventana, si baja del umbral. */
export function sugerenciaHabito(
  porcentajes: { nombre: string; pct: number }[],
  umbral = 60,
): string | null {
  if (porcentajes.length === 0) return null
  const peor = [...porcentajes].sort((x, y) => x.pct - y.pct)[0]
  if (peor.pct >= umbral) return null
  return `Tu hábito más flojo en 14 días es ${peor.nombre.toLowerCase()} (${peor.pct}%). Un pequeño empujón ahí vale doble.`
}

/** Sueño medio por debajo del objetivo (solo si hay suficientes noches registradas). */
export function sugerenciaSueno(
  horas: number[],
  objetivo: number,
): string | null {
  if (horas.length < 5) return null
  const media = horas.reduce((a, b) => a + b, 0) / horas.length
  if (media >= objetivo - 0.25) return null
  return `Duermes de media ${media.toFixed(1)} h y tu objetivo es ${objetivo} h. El músculo crece durmiendo.`
}
