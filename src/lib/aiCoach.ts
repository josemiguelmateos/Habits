import { localDateStr } from './days'
import { invokeFunction } from './functions'

const CACHE_KEY = 'habits:analisis-ia'

export interface AnalisisIA {
  texto: string
  fecha: string
}

export function analisisGuardado(): AnalisisIA | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as AnalisisIA
    return typeof v.texto === 'string' && typeof v.fecha === 'string' ? v : null
  } catch {
    return null
  }
}

/**
 * Pide el análisis a la Edge Function (que llama a Claude con la clave
 * guardada como secreto en Supabase). Devuelve el texto y lo cachea en el
 * dispositivo con la fecha.
 */
export async function pedirAnalisisIA(resumen: Record<string, unknown>): Promise<AnalisisIA> {
  const cuerpo = await invokeFunction<{ analisis?: string; error?: string }>({ resumen })
  if (!cuerpo?.analisis) {
    throw new Error(cuerpo?.error ?? 'Respuesta vacía del coach IA.')
  }
  const resultado: AnalisisIA = { texto: cuerpo.analisis, fecha: localDateStr() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(resultado))
  return resultado
}
