import { supabase } from './supabase'
import { localDateStr } from './days'

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
 * Pide el análisis a la Edge Function ai-coach (que llama a Claude con la
 * clave guardada como secreto en Supabase). Devuelve el texto y lo cachea
 * en el dispositivo con la fecha.
 */
export async function pedirAnalisisIA(resumen: Record<string, unknown>): Promise<AnalisisIA> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: { resumen },
  })

  if (error) {
    // Sin cuerpo útil: función sin desplegar, sin sesión o error de red
    const msg = error.message ?? ''
    if (/not found|404|Failed to send/i.test(msg)) {
      throw new Error(
        'La función ai-coach no está desplegada todavía en Supabase (Edge Functions).',
      )
    }
    throw new Error(msg || 'No se pudo contactar con el coach IA.')
  }

  const cuerpo = data as { analisis?: string; error?: string } | null
  if (!cuerpo?.analisis) {
    throw new Error(cuerpo?.error ?? 'Respuesta vacía del coach IA.')
  }

  const resultado: AnalisisIA = { texto: cuerpo.analisis, fecha: localDateStr() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(resultado))
  return resultado
}
