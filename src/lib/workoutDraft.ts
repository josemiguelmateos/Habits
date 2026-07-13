/** Borrador local del entrenamiento en curso (por usuario+día). */

export interface WorkoutDraft {
  hechas: Record<string, boolean[]>
  pesos: Record<string, string>
  repsPorSerie: Record<string, string[]>
}

const PREFIX = 'habits:workout:'

export function draftKey(userId: string, fecha: string): string {
  return `${PREFIX}${userId}:${fecha}`
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Parseo defensivo: null si raw es null/JSON inválido/no-objeto; sub-campos que falten → {}. */
export function parseDraft(raw: string | null): WorkoutDraft | null {
  if (raw == null) return null
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!esObjeto(obj)) return null
  return {
    hechas: esObjeto(obj.hechas) ? (obj.hechas as Record<string, boolean[]>) : {},
    pesos: esObjeto(obj.pesos) ? (obj.pesos as Record<string, string>) : {},
    repsPorSerie: esObjeto(obj.repsPorSerie)
      ? (obj.repsPorSerie as Record<string, string[]>)
      : {},
  }
}

export function loadDraft(userId: string, fecha: string): WorkoutDraft | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(userId, fecha)))
  } catch {
    return null
  }
}

export function saveDraft(userId: string, fecha: string, draft: WorkoutDraft): void {
  try {
    localStorage.setItem(draftKey(userId, fecha), JSON.stringify(draft))
  } catch {
    // almacenamiento no disponible o lleno: ignorar
  }
}

/** Borra los borradores de este usuario de otros días (deja solo el de `fecha`). */
export function pruneOldDrafts(userId: string, fecha: string): void {
  try {
    const conservar = draftKey(userId, fecha)
    const userPrefix = `${PREFIX}${userId}:`
    const aBorrar: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(userPrefix) && k !== conservar) aBorrar.push(k)
    }
    for (const k of aBorrar) localStorage.removeItem(k)
  } catch {
    // ignorar
  }
}
