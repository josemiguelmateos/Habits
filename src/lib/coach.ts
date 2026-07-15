/**
 * Coach de recomendaciones: reglas calculadas sobre tus datos reales
 * (sin IA externa, sin coste, sin latencia). Devuelve sugerencias
 * accionables, no frases genéricas.
 */

import type { SetConSerie } from './lastSession'

export interface SesionPeso {
  fecha: string
  /** peso máximo usado ese día */
  peso: number
  /** true si las reps hechas llegaron al objetivo */
  repsOk: boolean
}

export interface Progresion {
  tipo: 'subir' | 'bajar'
  peso: number
  /** nº de sesiones que justifican la recomendación */
  sesiones: number
}

/**
 * Doble progresión (estructurada, para chips y resúmenes): si las 2 últimas
 * sesiones fueron con el mismo peso cumpliendo reps, toca subir. Si lleva 4+
 * sesiones estancado en el mismo peso sin cumplir, sugiere bajar.
 */
export function analizarProgresion(
  sesiones: SesionPeso[], // ordenadas de más reciente a más antigua
  paso = 2.5,
): Progresion | null {
  if (sesiones.length < 2) return null
  const [a, b] = sesiones
  if (a.peso === b.peso && a.repsOk && b.repsOk) {
    return { tipo: 'subir', peso: Math.round((a.peso + paso) * 100) / 100, sesiones: 2 }
  }
  const mismoPeso = sesiones.filter((s) => s.peso === a.peso)
  if (mismoPeso.length >= 4 && mismoPeso.slice(0, 2).every((s) => !s.repsOk)) {
    return {
      tipo: 'bajar',
      peso: Math.round((a.peso - paso) * 100) / 100,
      sesiones: mismoPeso.length,
    }
  }
  return null
}

/** Versión en texto de la doble progresión (tarjeta Coach de Progreso). */
export function sugerenciaProgresion(
  nombre: string,
  sesiones: SesionPeso[], // ordenadas de más reciente a más antigua
  paso = 2.5,
): string | null {
  const r = analizarProgresion(sesiones, paso)
  if (!r) return null
  if (r.tipo === 'subir') {
    return `${nombre}: 2 sesiones cumpliendo reps con ${sesiones[0].peso} kg. Prueba ${r.peso} kg.`
  }
  return `${nombre}: ${r.sesiones} sesiones con ${sesiones[0].peso} kg sin cerrar las reps. Baja ${paso} kg y reconstruye.`
}

/**
 * Sesiones para la doble progresión a partir de set_logs con serie.
 * repsOk = nº de series del día >= objetivoSeries y todas las reps >= objetivoReps.
 * Las fechas sin peso registrado se descartan (no comparables).
 */
export function sesionesDesdeLogs(
  rows: SetConSerie[],
  objetivoSeries: number,
  objetivoReps: number,
): SesionPeso[] {
  const porFecha = new Map<string, SetConSerie[]>()
  for (const r of rows) {
    const a = porFecha.get(r.fecha) ?? []
    a.push(r)
    porFecha.set(r.fecha, a)
  }
  const out: SesionPeso[] = []
  for (const [fecha, delDia] of porFecha) {
    const pesos = delDia.map((r) => r.peso_usado).filter((p): p is number => p != null)
    if (pesos.length === 0) continue
    const repsOk =
      delDia.length >= objetivoSeries &&
      delDia.every((r) => r.reps_hechas != null && r.reps_hechas >= objetivoReps)
    out.push({ fecha, peso: Math.max(...pesos), repsOk })
  }
  return out.sort((x, y) => (x.fecha > y.fecha ? -1 : 1))
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
