import { supabase } from './supabase'

const esNoDesplegada = (msg: string) => /not found|404|Failed to send/i.test(msg)

/**
 * Invoca la Edge Function multiuso. El editor del dashboard de Supabase la
 * despliega con el slug de la plantilla (`quick-api`) aunque en la lista se
 * llame `ai-coach`, así que probamos primero uno y caemos al otro.
 */
export async function invokeFunction<T = unknown>(
  body: Record<string, unknown>,
): Promise<T> {
  let { data, error } = await supabase.functions.invoke('ai-coach', { body })
  if (error && esNoDesplegada(error.message ?? '')) {
    ;({ data, error } = await supabase.functions.invoke('quick-api', { body }))
  }
  if (error) {
    const msg = error.message ?? ''
    if (esNoDesplegada(msg)) {
      throw new Error(
        'La Edge Function no está desplegada (o está desactualizada) en Supabase.',
      )
    }
    throw new Error(msg || 'No se pudo contactar con la función.')
  }
  return data as T
}
