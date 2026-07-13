/** Marca (una por día) de que ya se celebró el día perfecto. */

const PREFIX = 'habits:perfect-cel:'

export function celebracionKey(fecha: string): string {
  return `${PREFIX}${fecha}`
}

export function celebracionHecha(fecha: string): boolean {
  try {
    return localStorage.getItem(celebracionKey(fecha)) === '1'
  } catch {
    return false
  }
}

export function marcarCelebracion(fecha: string): void {
  try {
    localStorage.setItem(celebracionKey(fecha), '1')
  } catch {
    // almacenamiento no disponible: ignorar
  }
}
