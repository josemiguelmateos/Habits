import { invokeFunction } from './functions'
import { PROMPT_DIETA, PROMPT_RUTINA } from './importPrompts'

export type ExtraidoDoc =
  | { formato: 'pdf'; pdf_base64: string }
  | { formato: 'texto'; contenido: string }

const MAX_MB = 8

/** Extensiones que aceptamos en el input de archivo. */
export const ACCEPT_IMPORT = '.json,.pdf,.xlsx,.xls,.csv,.txt'

function base64FromBuffer(buf: ArrayBuffer): string {
  let bin = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/**
 * Lee un archivo y lo deja listo para la IA:
 * - PDF → base64 (Claude lo lee de forma nativa).
 * - Excel/CSV → texto (SheetJS convierte cada hoja a CSV).
 * - Otro texto → su contenido.
 * (El .json se procesa aparte en el cliente, sin IA.)
 */
export async function extraerDeArchivo(file: File): Promise<ExtraidoDoc> {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`El archivo supera ${MAX_MB} MB. Usa uno más pequeño o pega el texto.`)
  }
  const nombre = file.name.toLowerCase()

  if (nombre.endsWith('.pdf')) {
    return { formato: 'pdf', pdf_base64: base64FromBuffer(await file.arrayBuffer()) }
  }

  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const partes = wb.SheetNames.map(
      (n) => `# Hoja: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`,
    )
    const contenido = partes.join('\n\n').trim()
    if (!contenido) throw new Error('El Excel no tiene contenido legible.')
    return { formato: 'texto', contenido }
  }

  // csv, txt, u otros como texto plano
  const contenido = (await file.text()).trim()
  if (!contenido) throw new Error('El archivo está vacío.')
  return { formato: 'texto', contenido }
}

/**
 * Envía el documento extraído a la Edge Function, que pide a Claude
 * convertirlo al esquema de la app. Devuelve el objeto crudo (sin validar).
 */
export async function convertirDocumento(
  tipo: 'rutina' | 'dieta',
  ex: ExtraidoDoc,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    accion: 'importar',
    tipo,
    formato: ex.formato,
    // Instrucciones para la IA desde el frontend: afinar sin redeplegar.
    system: tipo === 'rutina' ? PROMPT_RUTINA : PROMPT_DIETA,
  }
  if (ex.formato === 'pdf') body.pdf_base64 = ex.pdf_base64
  else body.contenido = ex.contenido

  const data = await invokeFunction<{ json?: unknown; error?: string }>(body)
  if (!data?.json) {
    throw new Error(data?.error ?? 'La IA no devolvió una estructura válida.')
  }
  return data.json
}
