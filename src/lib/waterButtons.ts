/** Cantidades de los botones rápidos de agua (configurables en Perfil). */
const KEY = 'habits:agua-botones'

export function getWaterAmounts(): [number, number] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw) as unknown
      if (
        Array.isArray(arr) &&
        arr.length === 2 &&
        arr.every((n) => typeof n === 'number' && n > 0)
      ) {
        return [arr[0], arr[1]]
      }
    }
  } catch {
    // valores por defecto
  }
  return [250, 500]
}

export function setWaterAmounts(a: number, b: number): void {
  localStorage.setItem(KEY, JSON.stringify([a, b]))
}
