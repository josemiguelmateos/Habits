/**
 * Lista de la compra: agrega los items de todas las comidas de la semana
 * y calcula el bruto total a comprar. Una comida que se repite N días
 * multiplica sus cantidades por N (`dias.length`).
 */

export interface ItemConDias {
  nombre: string
  categoria: string | null
  cantidad: number | null
  unidad: string | null
  dias: number[]
}

export interface LineaCompra {
  nombre: string
  categoria: string
  /** cantidad total de la semana; null si el item no lleva cantidad */
  cantidad: number | null
  unidad: string | null
  /** raciones/veces que aparece en la semana */
  veces: number
}

const SIN_CATEGORIA = 'Otros'

// Orden fijo de categorías para que la lista salga como un tique de super
const ORDEN_CATEGORIAS = [
  'Proteínas',
  'Hidratos',
  'Fruta y verdura',
  'Huevos y lácteos',
  'Otros',
]

export interface GrupoCompra {
  categoria: string
  lineas: LineaCompra[]
}

/** Agrega items → líneas de compra agrupadas por categoría. */
export function construirListaCompra(items: ItemConDias[]): GrupoCompra[] {
  const mapa = new Map<string, LineaCompra>()

  for (const it of items) {
    const veces = it.dias.length
    if (veces === 0) continue
    const unidad = it.unidad?.trim() || null
    const nombre = it.nombre.trim()
    if (!nombre) continue
    const key = `${nombre.toLowerCase()}||${unidad ?? ''}`
    const previo = mapa.get(key)
    const aporte = it.cantidad != null ? it.cantidad * veces : null

    if (!previo) {
      mapa.set(key, {
        nombre,
        categoria: it.categoria?.trim() || SIN_CATEGORIA,
        cantidad: aporte,
        unidad,
        veces,
      })
    } else {
      previo.veces += veces
      if (aporte != null) previo.cantidad = (previo.cantidad ?? 0) + aporte
    }
  }

  const porCategoria = new Map<string, LineaCompra[]>()
  for (const linea of mapa.values()) {
    const arr = porCategoria.get(linea.categoria) ?? []
    arr.push(linea)
    porCategoria.set(linea.categoria, arr)
  }

  const gruposOrdenados: GrupoCompra[] = []
  const categorias = [
    ...ORDEN_CATEGORIAS.filter((c) => porCategoria.has(c)),
    ...[...porCategoria.keys()].filter((c) => !ORDEN_CATEGORIAS.includes(c)).sort(),
  ]
  for (const cat of categorias) {
    const lineas = porCategoria
      .get(cat)!
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    gruposOrdenados.push({ categoria: cat, lineas })
  }
  return gruposOrdenados
}

/** Formatea una cantidad para mostrar: 1750 g → "1,75 kg", 250 ml, 3 uds… */
export function formatCantidad(linea: LineaCompra): string {
  const { cantidad, unidad, veces } = linea
  if (cantidad == null) {
    return veces > 1 ? `${veces} raciones` : 'al gusto'
  }
  if (unidad === 'g' && cantidad >= 1000) {
    return `${formatNum(cantidad / 1000)} kg`
  }
  if (unidad === 'ml' && cantidad >= 1000) {
    return `${formatNum(cantidad / 1000)} L`
  }
  const u = unidad ? ` ${unidad}` : ''
  return `${formatNum(cantidad)}${u}`
}

function formatNum(n: number): string {
  const redondeado = Math.round(n * 100) / 100
  return redondeado.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}
