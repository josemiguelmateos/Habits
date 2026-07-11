import { describe, expect, it } from 'vitest'
import { construirListaCompra, formatCantidad, type ItemConDias } from './shoppingList'

describe('construirListaCompra', () => {
  it('multiplica la cantidad por los días en los que se repite', () => {
    const items: ItemConDias[] = [
      { nombre: 'Arroz', categoria: 'Hidratos', cantidad: 250, unidad: 'g', dias: [1, 3, 5] },
    ]
    const grupos = construirListaCompra(items)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].lineas[0].cantidad).toBe(750) // 250 × 3
    expect(grupos[0].lineas[0].veces).toBe(3)
  })

  it('suma el mismo ingrediente aunque venga de comidas distintas', () => {
    const items: ItemConDias[] = [
      { nombre: 'Arroz', categoria: 'Hidratos', cantidad: 250, unidad: 'g', dias: [1] },
      { nombre: 'arroz', categoria: 'Hidratos', cantidad: 250, unidad: 'g', dias: [6] },
    ]
    const grupos = construirListaCompra(items)
    expect(grupos[0].lineas[0].cantidad).toBe(500)
    expect(grupos[0].lineas[0].veces).toBe(2)
  })

  it('no fusiona el mismo nombre con distinta unidad', () => {
    const items: ItemConDias[] = [
      { nombre: 'Leche', categoria: 'Huevos y lácteos', cantidad: 250, unidad: 'ml', dias: [1] },
      { nombre: 'Leche', categoria: 'Huevos y lácteos', cantidad: 1, unidad: 'brik', dias: [1] },
    ]
    const grupos = construirListaCompra(items)
    expect(grupos[0].lineas).toHaveLength(2)
  })

  it('mantiene los items sin cantidad y cuenta las veces', () => {
    const items: ItemConDias[] = [
      { nombre: 'Verdura', categoria: 'Fruta y verdura', cantidad: null, unidad: null, dias: [1, 2, 3] },
    ]
    const grupos = construirListaCompra(items)
    expect(grupos[0].lineas[0].cantidad).toBeNull()
    expect(grupos[0].lineas[0].veces).toBe(3)
  })

  it('agrupa por categoría en el orden de un tique', () => {
    const items: ItemConDias[] = [
      { nombre: 'Manzana', categoria: 'Fruta y verdura', cantidad: 1, unidad: 'pieza', dias: [1] },
      { nombre: 'Pollo', categoria: 'Proteínas', cantidad: 100, unidad: 'g', dias: [1] },
      { nombre: 'Pan', categoria: 'Hidratos', cantidad: 3, unidad: 'rebanada', dias: [1] },
    ]
    const grupos = construirListaCompra(items)
    expect(grupos.map((g) => g.categoria)).toEqual([
      'Proteínas',
      'Hidratos',
      'Fruta y verdura',
    ])
  })

  it('ignora comidas sin días', () => {
    const items: ItemConDias[] = [
      { nombre: 'Arroz', categoria: 'Hidratos', cantidad: 250, unidad: 'g', dias: [] },
    ]
    expect(construirListaCompra(items)).toHaveLength(0)
  })
})

describe('formatCantidad', () => {
  it('convierte gramos a kg por encima de 1000', () => {
    expect(
      formatCantidad({ nombre: 'Arroz', categoria: 'Hidratos', cantidad: 1750, unidad: 'g', veces: 7 }),
    ).toBe('1,75 kg')
  })

  it('convierte ml a L por encima de 1000', () => {
    expect(
      formatCantidad({ nombre: 'Leche', categoria: 'Lácteos', cantidad: 1750, unidad: 'ml', veces: 7 }),
    ).toBe('1,75 L')
  })

  it('deja unidades pequeñas tal cual', () => {
    expect(
      formatCantidad({ nombre: 'Atún', categoria: 'Proteínas', cantidad: 3, unidad: 'lata', veces: 3 }),
    ).toBe('3 lata')
  })

  it('sin cantidad muestra raciones o "al gusto"', () => {
    expect(
      formatCantidad({ nombre: 'Verdura', categoria: 'x', cantidad: null, unidad: null, veces: 5 }),
    ).toBe('5 raciones')
    expect(
      formatCantidad({ nombre: 'Sal', categoria: 'x', cantidad: null, unidad: null, veces: 1 }),
    ).toBe('al gusto')
  })
})
