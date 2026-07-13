import { describe, expect, it } from 'vitest'
import { validateDietaJson } from './importDiet'

const conComida = (extra: Record<string, unknown>) => ({
  comidas: [{ dias: [1], slot: 'Comida', descripcion: 'algo', ...extra }],
})

describe('validateDietaJson — semana', () => {
  it('acepta una semana entera >= 1', () => {
    const r = validateDietaJson(conComida({ semana: 2 }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.comidas[0].semana).toBe(2)
  })

  it('deja semana en null si no viene', () => {
    const r = validateDietaJson(conComida({}))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.comidas[0].semana).toBeNull()
  })

  it('rechaza semana < 1 o no entera', () => {
    expect(validateDietaJson(conComida({ semana: 0 })).ok).toBe(false)
    expect(validateDietaJson(conComida({ semana: 1.5 })).ok).toBe(false)
  })
})
