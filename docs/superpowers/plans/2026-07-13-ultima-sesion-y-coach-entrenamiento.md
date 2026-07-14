# Defaults de la última sesión + coach de progresión — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada ejercicio del entrenamiento abra con los valores de la última sesión (peso y reps por serie) + línea fija "Última vez", con chips del coach para subir/bajar peso (Aplicar) y colores por serie al marcar; y que el análisis IA de Progreso reciba la progresión por ejercicio con reps reales.

**Architecture:** Lógica pura nueva en `lib/lastSession.ts` (última sesión por ejercicio + resúmenes) y ampliación de `lib/coach.ts` (`analizarProgresion` estructurada + `sesionesDesdeLogs` con repsOk real). `WorkoutPage` agrupa los `set_logs` previos (ahora con `serie`) por ejercicio y cambia las cadenas de defaults (borrador → última sesión → plan). `DashboardPage` usa repsOk real en el coach y añade `progresion_ejercicios` al resumen de la IA (la Edge Function no se toca: incrusta el JSON tal cual).

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase. Tests con vitest.

**Spec:** `docs/superpowers/specs/2026-07-13-ultima-sesion-y-coach-entrenamiento-design.md`

---

## File Structure

- **Create** `src/lib/lastSession.ts` — `SetConSerie`, `UltimaSesion`, `ultimaSesionPorEjercicio`, `resumenUltimaSesion`, `resumenesUltimasSesiones`. Puro.
- **Create** `src/lib/lastSession.test.ts`.
- **Modify** `src/lib/coach.ts` — `analizarProgresion` (estructurada; `sugerenciaProgresion` se reimplementa sobre ella) + `sesionesDesdeLogs`.
- **Modify** `src/lib/coach.test.ts` — tests nuevos (los 5 actuales sin cambios).
- **Modify** `src/pages/WorkoutPage.tsx` — `serie` en el select, mapas por ejercicio, defaults, línea "Última vez", chips con Aplicar, colores por serie.
- **Modify** `src/pages/DashboardPage.tsx` — objetivos del plan, repsOk real en el memo `coach`, `progresion_ejercicios` en `generarIA`.

---

## Task 1: `lib/lastSession.ts` — última sesión por ejercicio (TDD)

**Files:**
- Create: `src/lib/lastSession.ts`
- Test: `src/lib/lastSession.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/lastSession.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ultimaSesionPorEjercicio,
  resumenUltimaSesion,
  resumenesUltimasSesiones,
  type SetConSerie,
} from './lastSession'

const row = (
  fecha: string,
  serie: number,
  reps: number | null,
  peso: number | null,
  ex = 'e1',
): SetConSerie => ({ exercise_id: ex, fecha, serie, reps_hechas: reps, peso_usado: peso })

describe('ultimaSesionPorEjercicio', () => {
  it('devuelve la sesión de la fecha más reciente, con reps por serie y peso máx del día', () => {
    const rows = [
      row('2026-07-06', 1, 12, 20),
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 2, 12, 22),
      row('2026-07-13', 3, 8, 20),
    ]
    const m = ultimaSesionPorEjercicio(rows)
    const s = m.get('e1')!
    expect(s.fecha).toBe('2026-07-13')
    expect(s.peso).toBe(22)
    expect(s.reps).toEqual([12, 12, 8])
  })

  it('deja huecos null en las series que faltan', () => {
    const m = ultimaSesionPorEjercicio([
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 3, 8, 20),
    ])
    expect(m.get('e1')!.reps).toEqual([12, null, 8])
  })

  it('separa por ejercicio', () => {
    const m = ultimaSesionPorEjercicio([
      row('2026-07-13', 1, 12, 20, 'e1'),
      row('2026-07-10', 1, 10, 30, 'e2'),
    ])
    expect(m.get('e1')!.fecha).toBe('2026-07-13')
    expect(m.get('e2')!.fecha).toBe('2026-07-10')
  })

  it('sin peso registrado, peso es null', () => {
    const m = ultimaSesionPorEjercicio([row('2026-07-13', 1, 12, null)])
    expect(m.get('e1')!.peso).toBeNull()
  })
})

describe('resumenUltimaSesion', () => {
  it('formatea reps y peso', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: 20, reps: [12, 12, 8, 8] }),
    ).toBe('12·12·8·8 × 20 kg')
  })

  it('sin peso muestra solo reps; huecos como guion', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: null, reps: [12, null, 8] }),
    ).toBe('12·–·8')
  })

  it('sin reps (todas null) muestra solo el peso', () => {
    expect(
      resumenUltimaSesion({ fecha: '2026-07-13', peso: 20, reps: [null, null] }),
    ).toBe('20 kg')
  })
})

describe('resumenesUltimasSesiones', () => {
  it('devuelve hasta N sesiones, la más reciente primero, con fecha', () => {
    const rows = [
      row('2026-07-01', 1, 12, 18),
      row('2026-07-06', 1, 12, 20),
      row('2026-07-13', 1, 12, 20),
      row('2026-07-13', 2, 8, 20),
    ]
    expect(resumenesUltimasSesiones(rows, 2)).toEqual([
      '12·8 × 20 kg (2026-07-13)',
      '12 × 20 kg (2026-07-06)',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lastSession.test.ts`
Expected: FAIL — `Failed to load url ./lastSession`.

- [ ] **Step 3: Write implementation**

Create `src/lib/lastSession.ts`:

```ts
/** Última sesión registrada por ejercicio (reps por serie + peso del día). */

import type { SetLike } from './stats'

export interface SetConSerie extends SetLike {
  serie: number
}

export interface UltimaSesion {
  fecha: string
  /** máx peso_usado del día; null si ninguna serie llevó peso */
  peso: number | null
  /** reps por serie (índice = serie - 1); huecos → null */
  reps: (number | null)[]
}

function sesionDeFecha(rows: SetConSerie[], fecha: string): UltimaSesion {
  const delDia = rows.filter((r) => r.fecha === fecha)
  let peso: number | null = null
  const reps: (number | null)[] = []
  for (const r of delDia) {
    if (r.peso_usado != null) peso = peso == null ? r.peso_usado : Math.max(peso, r.peso_usado)
    reps[r.serie - 1] = r.reps_hechas
  }
  // los huecos de Array quedan undefined → normaliza a null
  for (let i = 0; i < reps.length; i++) if (reps[i] === undefined) reps[i] = null
  return { fecha, peso, reps }
}

/** Sesión más reciente de cada ejercicio. */
export function ultimaSesionPorEjercicio(rows: SetConSerie[]): Map<string, UltimaSesion> {
  const porEx = new Map<string, SetConSerie[]>()
  for (const r of rows) {
    const a = porEx.get(r.exercise_id) ?? []
    a.push(r)
    porEx.set(r.exercise_id, a)
  }
  const out = new Map<string, UltimaSesion>()
  for (const [ex, exRows] of porEx) {
    const ultimaFecha = exRows.reduce((m, r) => (r.fecha > m ? r.fecha : m), '')
    out.set(ex, sesionDeFecha(exRows, ultimaFecha))
  }
  return out
}

/** "12·12·8·8 × 20 kg" · sin peso → solo reps (huecos como –) · sin reps → "20 kg". */
export function resumenUltimaSesion(s: UltimaSesion): string {
  const conReps = s.reps.some((r) => r != null)
  const repsStr = conReps ? s.reps.map((r) => (r == null ? '–' : String(r))).join('·') : ''
  if (conReps && s.peso != null) return `${repsStr} × ${s.peso} kg`
  if (conReps) return repsStr
  return s.peso != null ? `${s.peso} kg` : ''
}

/** Hasta `max` sesiones de un ejercicio, la más reciente primero, con fecha. */
export function resumenesUltimasSesiones(rows: SetConSerie[], max = 3): string[] {
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort().reverse().slice(0, max)
  return fechas.map((f) => `${resumenUltimaSesion(sesionDeFecha(rows, f))} (${f})`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lastSession.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lastSession.ts src/lib/lastSession.test.ts
git commit -m "lastSession: ultima sesion por ejercicio + resumenes (con tests)"
```

---

## Task 2: `lib/coach.ts` — `analizarProgresion` + `sesionesDesdeLogs` (TDD)

**Files:**
- Modify: `src/lib/coach.ts`
- Modify: `src/lib/coach.test.ts`

- [ ] **Step 1: Write the failing tests**

Añade al final de `src/lib/coach.test.ts` (los imports de la línea 2 pasan a incluir las funciones nuevas):

```ts
import { analizarProgresion, sesionesDesdeLogs } from './coach'
import type { SetConSerie } from './lastSession'

describe('analizarProgresion', () => {
  it('estructura la subida tras 2 sesiones cumpliendo al mismo peso', () => {
    const r = analizarProgresion([
      { fecha: '2026-07-13', peso: 20, repsOk: true },
      { fecha: '2026-07-06', peso: 20, repsOk: true },
    ])
    expect(r).toEqual({ tipo: 'subir', peso: 22.5, sesiones: 2 })
  })

  it('estructura la bajada tras 4+ sesiones estancado', () => {
    const r = analizarProgresion([
      { fecha: '2026-07-13', peso: 30, repsOk: false },
      { fecha: '2026-07-10', peso: 30, repsOk: false },
      { fecha: '2026-07-06', peso: 30, repsOk: true },
      { fecha: '2026-07-03', peso: 30, repsOk: false },
    ])
    expect(r).toEqual({ tipo: 'bajar', peso: 27.5, sesiones: 4 })
  })

  it('null si no toca cambiar', () => {
    expect(
      analizarProgresion([
        { fecha: '2026-07-13', peso: 22.5, repsOk: true },
        { fecha: '2026-07-06', peso: 20, repsOk: true },
      ]),
    ).toBeNull()
  })
})

describe('sesionesDesdeLogs', () => {
  const log = (fecha: string, serie: number, reps: number | null, peso: number | null): SetConSerie =>
    ({ exercise_id: 'e1', fecha, serie, reps_hechas: reps, peso_usado: peso })

  it('agrupa por fecha (reciente primero) con peso max y repsOk', () => {
    const s = sesionesDesdeLogs(
      [
        log('2026-07-06', 1, 12, 20), log('2026-07-06', 2, 12, 20),
        log('2026-07-13', 1, 12, 22), log('2026-07-13', 2, 12, 22),
      ],
      2, // objetivo series
      12, // objetivo reps
    )
    expect(s).toEqual([
      { fecha: '2026-07-13', peso: 22, repsOk: true },
      { fecha: '2026-07-06', peso: 20, repsOk: true },
    ])
  })

  it('repsOk falso si faltan series, si alguna rep queda corta o es null', () => {
    const pocas = sesionesDesdeLogs([log('2026-07-13', 1, 12, 20)], 2, 12)
    expect(pocas[0].repsOk).toBe(false)
    const cortas = sesionesDesdeLogs(
      [log('2026-07-13', 1, 12, 20), log('2026-07-13', 2, 8, 20)],
      2, 12,
    )
    expect(cortas[0].repsOk).toBe(false)
    const nulas = sesionesDesdeLogs(
      [log('2026-07-13', 1, 12, 20), log('2026-07-13', 2, null, 20)],
      2, 12,
    )
    expect(nulas[0].repsOk).toBe(false)
  })

  it('descarta fechas sin peso registrado (no comparables)', () => {
    const s = sesionesDesdeLogs([log('2026-07-13', 1, 12, null)], 1, 12)
    expect(s).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/coach.test.ts`
Expected: los 5 antiguos PASS, los nuevos FAIL (funciones no exportadas).

- [ ] **Step 3: Implementar en `coach.ts`**

(a) Añade el import al principio de `src/lib/coach.ts`:

```ts
import type { SetConSerie } from './lastSession'
```

(b) Añade `analizarProgresion` y reimplementa `sugerenciaProgresion` sobre ella. Sustituye el cuerpo actual de `sugerenciaProgresion` (líneas del `if (sesiones.length < 2)` al `return null`) por:

```ts
export interface Progresion {
  tipo: 'subir' | 'bajar'
  peso: number
  /** nº de sesiones que justifican la recomendación */
  sesiones: number
}

/** Versión estructurada de la doble progresión (para chips y resúmenes). */
export function analizarProgresion(
  sesiones: SesionPeso[], // ordenadas de más reciente a más antigua
  paso = 2.5,
): Progresion | null {
  if (sesiones.length < 2) return null
  const [a, b] = sesiones
  if (a.peso === b.peso && a.repsOk && b.repsOk) {
    return { tipo: 'subir', peso: Math.round((a.peso + paso) * 100) / 100, sesiones: 2 }
  }
  const mismoPeso = sesiones.filter((s) => s.peso === a.peso)
  if (mismoPeso.length >= 4 && mismoPeso.slice(0, 2).every((s) => !s.repsOk)) {
    return {
      tipo: 'bajar',
      peso: Math.round((a.peso - paso) * 100) / 100,
      sesiones: mismoPeso.length,
    }
  }
  return null
}

export function sugerenciaProgresion(
  nombre: string,
  sesiones: SesionPeso[], // ordenadas de más reciente a más antigua
  paso = 2.5,
): string | null {
  const r = analizarProgresion(sesiones, paso)
  if (!r) return null
  if (r.tipo === 'subir') {
    return `${nombre}: 2 sesiones cumpliendo reps con ${sesiones[0].peso} kg. Prueba ${r.peso} kg.`
  }
  return `${nombre}: ${r.sesiones} sesiones con ${sesiones[0].peso} kg sin cerrar las reps. Baja ${paso} kg y reconstruye.`
}
```

OJO: el texto de "bajar" del código actual dice `sin cerrar las reps`; comprueba el literal EXACTO del archivo antes de reemplazar y consérvalo (el test existente exige `toContain('Baja 2.5 kg')` y `toContain('42.5 kg')`).

(c) Añade `sesionesDesdeLogs` al final del archivo:

```ts
/**
 * Sesiones para la doble progresión a partir de set_logs con serie.
 * repsOk = nº de series del día >= objetivoSeries y todas las reps >= objetivoReps.
 * Las fechas sin peso registrado se descartan (no comparables).
 */
export function sesionesDesdeLogs(
  rows: SetConSerie[],
  objetivoSeries: number,
  objetivoReps: number,
): SesionPeso[] {
  const porFecha = new Map<string, SetConSerie[]>()
  for (const r of rows) {
    const a = porFecha.get(r.fecha) ?? []
    a.push(r)
    porFecha.set(r.fecha, a)
  }
  const out: SesionPeso[] = []
  for (const [fecha, delDia] of porFecha) {
    const pesos = delDia.map((r) => r.peso_usado).filter((p): p is number => p != null)
    if (pesos.length === 0) continue
    const repsOk =
      delDia.length >= objetivoSeries &&
      delDia.every((r) => r.reps_hechas != null && r.reps_hechas >= objetivoReps)
    out.push({ fecha, peso: Math.max(...pesos), repsOk })
  }
  return out.sort((x, y) => (x.fecha > y.fecha ? -1 : 1))
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/coach.test.ts`
Expected: PASS (5 antiguos + 6 nuevos = 11).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coach.ts src/lib/coach.test.ts
git commit -m "coach: analizarProgresion estructurada + sesionesDesdeLogs con reps reales"
```

---

## Task 3: WorkoutPage — datos por ejercicio, defaults y línea "Última vez"

**Files:**
- Modify: `src/pages/WorkoutPage.tsx`

- [ ] **Step 1: Imports y estado**

Añade a los imports:

```tsx
import { ultimaSesionPorEjercicio, resumenUltimaSesion, type SetConSerie, type UltimaSesion } from '../lib/lastSession'
import { analizarProgresion, sesionesDesdeLogs } from '../lib/coach'
```

Junto al estado `sparks`, añade:

```tsx
  const [ultimaPorEx, setUltimaPorEx] = useState<Map<string, UltimaSesion>>(new Map())
  const [logsPorEx, setLogsPorEx] = useState<Map<string, SetConSerie[]>>(new Map())
```

- [ ] **Step 2: Añadir `serie` al select y construir los mapas**

En el `useEffect` de carga, cambia el select de `set_logs`:

```tsx
        supabase
          .from('set_logs')
          .select('exercise_id, fecha, serie, reps_hechas, peso_usado')
          .lt('fecha', hoyStr),
```

Y tras `setSparks(sparkMap)` (antes de cerrar el async), añade:

```tsx
      const conSerie = (sl.data ?? []) as SetConSerie[]
      setUltimaPorEx(ultimaSesionPorEjercicio(conSerie))
      const porEx = new Map<string, SetConSerie[]>()
      for (const r of conSerie) {
        const a = porEx.get(r.exercise_id) ?? []
        a.push(r)
        porEx.set(r.exercise_id, a)
      }
      setLogsPorEx(porEx)
```

- [ ] **Step 3: Peso efectivo (borrador → última sesión → plan)**

Justo antes de `repsDeSerie`, añade el helper y cámbialo TODO a esta cadena:

```tsx
  // Peso efectivo: lo escrito hoy → el de la última sesión → el del plan
  const pesoEfectivoStr = (it: RoutineItem): string => {
    const escrito = pesos[it.id]
    if (escrito != null) return escrito
    const ult = ultimaPorEx.get(it.exercise_id)?.peso
    if (ult != null) return String(ult)
    return it.peso != null ? String(it.peso) : ''
  }
```

Sustituye la construcción de `pesoStr` en `volumenSesion`:

```tsx
      const pesoStr = pesoEfectivoStr(it).trim().replace(',', '.')
```

Y en `marcarSerie`:

```tsx
      const pesoStr = pesoEfectivoStr(it).trim()
```

- [ ] **Step 4: Reps por defecto de la última sesión**

Sustituye `repsDeSerie` por:

```tsx
  // Reps reales por serie: lo escrito hoy → la última sesión → el objetivo
  const repsDeSerie = (it: RoutineItem, serie: number): number => {
    const raw = (repsPorSerie[it.id]?.[serie] ?? '').trim()
    if (raw !== '') {
      const n = parseInt(raw, 10)
      return Number.isNaN(n) ? 0 : n
    }
    const ult = ultimaPorEx.get(it.exercise_id)?.reps[serie]
    if (ult != null) return ult
    const n = parseInt(it.reps, 10)
    return Number.isNaN(n) ? 0 : n
  }
```

- [ ] **Step 5: Derivados del ejercicio actual + inputs**

Tras `const item: RoutineItem | undefined = items[idx]`, añade:

```tsx
  const ultima = item ? ultimaPorEx.get(item.exercise_id) : undefined
  const reco = item
    ? analizarProgresion(
        sesionesDesdeLogs(
          logsPorEx.get(item.exercise_id) ?? [],
          item.series,
          parseInt(item.reps, 10) || 0,
        ),
      )
    : null
```

Cambia el `value` del input "Peso de hoy" (deja placeholder/onChange/onBlur igual):

```tsx
                value={pesoEfectivoStr(item)}
```

Y el `value` del input de reps de cada serie:

```tsx
                      value={
                        repsPorSerie[item.id]?.[s] ??
                        (ultima?.reps[s] != null
                          ? String(ultima.reps[s])
                          : String(parseInt(item.reps, 10) || ''))
                      }
```

- [ ] **Step 6: Línea "Última vez"**

Justo ENCIMA del bloque `{/* Peso de hoy ... */}`, añade:

```tsx
            {ultima && (
              <p className="mt-5 text-xs text-zinc-500">
                Última vez:{' '}
                <span className="font-semibold text-zinc-300">
                  {resumenUltimaSesion(ultima)}
                </span>
              </p>
            )}
```

Y en el `div` del bloque "Peso de hoy", cambia `mt-5` por `mt-2` cuando haya línea; para no complicar, déjalo así:

```tsx
            <div className={`${ultima ? 'mt-2' : 'mt-5'} flex items-center gap-3`}>
```

- [ ] **Step 7: Typecheck + build + commit**

Run: `npm run build` → Expected: compila.

```bash
git add src/pages/WorkoutPage.tsx
git commit -m "Entrenamiento: defaults de la ultima sesion + linea Ultima vez"
```

---

## Task 4: WorkoutPage — chips del coach + colores por serie

**Files:**
- Modify: `src/pages/WorkoutPage.tsx`

- [ ] **Step 1: Chip del coach con Aplicar**

Justo DEBAJO de la línea "Última vez" (y antes del bloque "Peso de hoy"), añade:

```tsx
            {reco && item && pesoEfectivoStr(item).replace(',', '.') !== String(reco.peso) && (
              <div
                className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
                  reco.tipo === 'subir'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                }`}
              >
                <span className="font-medium">
                  {reco.tipo === 'subir'
                    ? `⚡ Sube a ${reco.peso} kg · 2 sesiones cumpliendo`
                    : `↓ Baja a ${reco.peso} kg · ${reco.sesiones} sesiones sin cerrar las reps`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPesos((p) => ({ ...p, [item.id]: String(reco.peso) }))
                    void supabase
                      .from('routine_day_exercises')
                      .update({ peso: reco.peso })
                      .eq('id', item.id)
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 font-display text-xs font-bold ${
                    reco.tipo === 'subir'
                      ? 'bg-accent text-accent-ink'
                      : 'bg-amber-500 text-ink'
                  }`}
                >
                  Aplicar
                </button>
              </div>
            )}
```

(Al aplicar, `pesos[item.id]` pasa a ser el sugerido → la condición del chip deja de cumplirse y desaparece.)

- [ ] **Step 2: Colores por serie al marcar**

Dentro del `.map` de series, la clase del input de reps es hoy:

```tsx
                      className={`w-11 rounded-lg border bg-ink-soft py-1.5 text-center font-display text-sm font-semibold outline-none focus:border-accent ${
                        hecha ? 'border-accent/40 text-accent' : 'border-ink-border text-zinc-100'
                      }`}
```

Sustitúyela usando una función definida junto a `repsDeSerie`:

```tsx
  // Color del input de reps al marcar: verde si superaste la última sesión, ámbar si quedaste corto.
  const claseRepsSerie = (it: RoutineItem, s: number, hecha: boolean): string => {
    if (!hecha) return 'border-ink-border text-zinc-100'
    const ref = ultimaPorEx.get(it.exercise_id)?.reps[s]
    if (ref != null) {
      const hechasReps = repsDeSerie(it, s)
      if (hechasReps > ref) return 'border-accent text-accent'
      if (hechasReps < ref) return 'border-amber-500/60 text-amber-400'
    }
    return 'border-accent/40 text-accent'
  }
```

Y en el input:

```tsx
                      className={`w-11 rounded-lg border bg-ink-soft py-1.5 text-center font-display text-sm font-semibold outline-none focus:border-accent ${claseRepsSerie(item, s, hecha)}`}
```

- [ ] **Step 3: Typecheck + build + commit**

Run: `npm run build` → Expected: compila.

```bash
git add src/pages/WorkoutPage.tsx
git commit -m "Entrenamiento: chips del coach (subir/bajar con Aplicar) + colores por serie"
```

---

## Task 5: DashboardPage — repsOk real + `progresion_ejercicios` en la IA

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Imports y datos del plan**

Añade a los imports:

```tsx
import { sesionesDesdeLogs, analizarProgresion } from '../lib/coach'
import { resumenesUltimasSesiones, type SetConSerie } from '../lib/lastSession'
```

En el `useEffect` que carga `exercises`/`set_logs`/`exercise_day_logs`, añade una cuarta query al `Promise.all` y su estado:

- Estado (junto a `exNames`): `const [objetivoPorEx, setObjetivoPorEx] = useState<Map<string, { series: number; reps: number }>>(new Map())`
- El select de `set_logs` pasa a incluir `serie`: `.select('exercise_id, fecha, serie, reps_hechas, peso_usado')`
- Query nueva en el `Promise.all`: `supabase.from('routine_day_exercises').select('exercise_id, series, reps')`
- Tras procesar, construir el mapa (si un ejercicio está en varios días, gana el de más series):

```tsx
      const objetivos = new Map<string, { series: number; reps: number }>()
      for (const r of (rde.data ?? []) as { exercise_id: string; series: number; reps: string }[]) {
        const prev = objetivos.get(r.exercise_id)
        if (!prev || r.series > prev.series) {
          objetivos.set(r.exercise_id, { series: r.series, reps: parseInt(r.reps, 10) || 0 })
        }
      }
      setObjetivoPorEx(objetivos)
```

`setRows` ya se guarda; castea a `SetConSerie[]` donde haga falta (el select ahora trae `serie`).

- [ ] **Step 2: repsOk real en el memo `coach`**

El memo `coach` actual construye `sesiones` desde `pesoPorEjercicio` con `repsOk: true`. Sustituye ese bucle por uno sobre los ejercicios con datos usando `sesionesDesdeLogs`:

```tsx
  const coach = useMemo(() => {
    const out: string[] = []
    const porEx = new Map<string, SetConSerie[]>()
    for (const r of setRows as SetConSerie[]) {
      const a = porEx.get(r.exercise_id) ?? []
      a.push(r)
      porEx.set(r.exercise_id, a)
    }
    for (const [exId, rows] of porEx) {
      if (out.length >= 2) break
      const obj = objetivoPorEx.get(exId)
      if (!obj) continue
      const s = sugerenciaProgresion(
        exNames.get(exId) ?? 'Ejercicio',
        sesionesDesdeLogs(rows, obj.series, obj.reps),
      )
      if (s) out.push(s)
    }
    // ... (el resto del memo — sugerenciaHabito y sugerenciaSueno — queda igual)
```

Ajusta las dependencias del memo: quita `pesoPorEjercicio` y añade `setRows, objetivoPorEx` (mantén `exNames, doneSets, byFecha, profile, today`). `pesoPorEjercicio` se conserva (lo usa el `<select>`/`ejercicios`).

- [ ] **Step 3: `progresion_ejercicios` en `generarIA`**

En `generarIA`, antes de construir `resumen`, añade:

```tsx
    const porEx = new Map<string, SetConSerie[]>()
    for (const r of setRows as SetConSerie[]) {
      const a = porEx.get(r.exercise_id) ?? []
      a.push(r)
      porEx.set(r.exercise_id, a)
    }
    const progresionEjercicios = [...porEx.entries()]
      .map(([exId, rows]) => ({ exId, rows, ultima: rows.reduce((m, r) => (r.fecha > m ? r.fecha : m), '') }))
      .sort((a, b) => (a.ultima > b.ultima ? -1 : 1))
      .slice(0, 8)
      .map(({ exId, rows }) => {
        const obj = objetivoPorEx.get(exId)
        const reco = obj
          ? analizarProgresion(sesionesDesdeLogs(rows, obj.series, obj.reps))
          : null
        return {
          nombre: exNames.get(exId) ?? '—',
          ultimas_sesiones: resumenesUltimasSesiones(rows, 3),
          sugerencia_regla: reco ? `${reco.tipo} a ${reco.peso} kg` : null,
        }
      })
```

Y en el objeto `resumen`, añade la clave:

```tsx
      progresion_ejercicios: progresionEjercicios,
```

- [ ] **Step 4: Typecheck + build + commit**

Run: `npm run build` → Expected: compila (la Edge Function no se toca).

```bash
git add src/pages/DashboardPage.tsx
git commit -m "Progreso: coach con reps reales + progresion por ejercicio en el analisis IA"
```

---

## Task 6: verificación en navegador

**Files:** (ninguno — verificación)

- [ ] **Step 1: Tests + build**

Run: `npx vitest run` → Expected: verde (87 previos + 8 lastSession + 6 coach = 101).
Run: `npm run build` → Expected: compila.

- [ ] **Step 2: Sembrar 2 sesiones cumpliendo (cuenta +prueba)**

Script Node local (las escrituras por fetch del navegador las bloquea el clasificador): en un ejercicio del día actual del plan (p. ej. "Jalones pala", objetivo 4×12), sembrar 2 fechas pasadas con 4 series × 12 reps × 20 kg cada una. Si la sesión del navegador caducó (login), pedir al usuario que reloguee.

- [ ] **Step 3: Verificar defaults + chip**

En `/entrenar` (el ejercicio sembrado): el peso sale `20` como valor; las reps por serie `12`; la línea "Última vez: 12·12·12·12 × 20 kg"; y el chip lima "⚡ Sube a 22.5 kg · 2 sesiones cumpliendo" con botón Aplicar. Tocar **Aplicar** → el peso pasa a `22.5`, el chip desaparece, y `routine_day_exercises.peso` queda en 22.5 (consultar por script).

- [ ] **Step 4: Verificar colores por serie**

Poner reps de la serie 1 en 13 y marcarla → input verde (`border-accent text-accent`). Poner la serie 2 en 8 y marcarla → ámbar. Serie 3 en 12 → estilo estándar de marcado. (Comprobar clases con `javascript_exec`.)

- [ ] **Step 5: Verificar resumen IA (red)**

En `/progreso`, pulsar "Análisis IA" y comprobar por `read_network_requests` que el body enviado incluye `progresion_ejercicios` con `ultimas_sesiones` y `sugerencia_regla`. (La respuesta depende de la Edge Function; basta validar el request.)

- [ ] **Step 6: Limpiar**

Borrar los set_logs sembrados y los de hoy generados en la prueba, restaurar `routine_day_exercises.peso` del ejercicio a su valor previo, y limpiar el borrador de localStorage. Confirmar cuenta limpia.

---

## Self-review (hecho)

- **Cobertura del spec:** lastSession (Task 1), analizarProgresion/sesionesDesdeLogs (Task 2), defaults + línea (Task 3), chips + colores (Task 4), Dashboard repsOk real + IA (Task 5), verificación (Task 6). ✔
- **Sin placeholders:** el único "..." está en Task 5 Step 2 marcando explícitamente el código que NO cambia del memo. ✔
- **Consistencia de tipos:** `SetConSerie extends SetLike` (lastSession); `UltimaSesion { fecha, peso, reps }`; `analizarProgresion → Progresion { tipo, peso, sesiones } | null`; `sesionesDesdeLogs(rows, objetivoSeries, objetivoReps) → SesionPeso[]`; `pesoEfectivoStr`, `repsDeSerie`, `claseRepsSerie` usados coherentemente. ✔
- **Nota:** en Task 2 el literal del mensaje de "bajar" debe copiarse del archivo real para no romper el test existente. ✔
