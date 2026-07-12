# Sparklines de progresión + unificar Progreso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir sparklines de progresión (SVG puro, sin Recharts) en el modo entrenamiento y en las filas de la rutina, y unificar la gráfica de "Progresión de cargas" del Dashboard para que reutilice `ExerciseProgressChart` (métricas 1RM/peso/volumen + PRs).

**Architecture:** Una pieza pura nueva (`lib/sparkline.ts`) que reutiliza `buildProgressSeries` y genera el `d` de un `<path>`; un componente fino `Sparkline.tsx` que lo pinta. WorkoutPage y RoutinePage cargan histórico y muestran el sparkline; el Dashboard estrena una prop `bare` en `ExerciseProgressChart`. Nada de esto mete Recharts en los bundles de rutina/entrenamiento.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + Recharts (solo en Progreso/ficha) + Supabase. Tests con vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-sparklines-progresion-design.md`

---

## File Structure

- **Create** `src/lib/sparkline.ts` — `sparklineSeries()` (elige valores 1RM/peso) y `sparklinePath()` (genera el path SVG). Puro.
- **Create** `src/lib/sparkline.test.ts` — tests de ambas funciones.
- **Create** `src/components/exercise/Sparkline.tsx` — `<svg>` diminuto con línea + punto final. Sin dependencias.
- **Modify** `src/components/exercise/ExerciseProgressChart.tsx` — prop `bare`.
- **Modify** `src/pages/DashboardPage.tsx` — usa `<ExerciseProgressChart bare>` en vez del `LineChart` manual de solo peso.
- **Modify** `src/pages/WorkoutPage.tsx` — `reps_hechas` en la query + mapa de sparklines + strip bajo el subtítulo.
- **Modify** `src/pages/RoutinePage.tsx` — carga histórico de todos los ejercicios → mapa de valores → `DayCard`.
- **Modify** `src/components/routine/DayCard.tsx` — prop `sparklines` → `<Sparkline>` en cada fila antes del chip de peso.

---

## Task 1: `lib/sparkline.ts` — lógica pura (TDD)

**Files:**
- Create: `src/lib/sparkline.ts`
- Test: `src/lib/sparkline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sparkline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sparklineSeries, sparklinePath } from './sparkline'
import type { SetLike, PesoFecha } from './stats'

describe('sparklineSeries', () => {
  it('usa 1RM cuando hay reps en el histórico', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: 8, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-08', reps_hechas: 10, peso_usado: 22 },
    ]
    const r = sparklineSeries(sets, [])
    expect(r.metrica).toBe('oneRM')
    expect(r.values).toHaveLength(2)
    expect(r.values[1]).toBeGreaterThan(r.values[0]) // 27.9 -> 29.3
  })

  it('cae a peso máx si ningún punto tiene reps (incluye day_logs)', () => {
    const dayLogs: PesoFecha[] = [
      { exercise_id: 'e1', fecha: '2026-06-20', peso: 20 },
      { exercise_id: 'e1', fecha: '2026-06-27', peso: 25 },
    ]
    const r = sparklineSeries([], dayLogs)
    expect(r.metrica).toBe('pesoMax')
    expect(r.values).toEqual([20, 25])
  })

  it('descarta los puntos sin 1RM cuando la métrica es oneRM', () => {
    const sets: SetLike[] = [
      { exercise_id: 'e1', fecha: '2026-07-01', reps_hechas: null, peso_usado: 22 },
      { exercise_id: 'e1', fecha: '2026-07-08', reps_hechas: 10, peso_usado: 22 },
    ]
    const r = sparklineSeries(sets, [])
    expect(r.metrica).toBe('oneRM')
    expect(r.values).toHaveLength(1)
  })

  it('sin datos devuelve values vacío', () => {
    expect(sparklineSeries([], []).values).toEqual([])
  })
})

describe('sparklinePath', () => {
  it('devuelve cadena vacía con menos de 2 puntos', () => {
    expect(sparklinePath([], 100, 20)).toBe('')
    expect(sparklinePath([5], 100, 20)).toBe('')
  })

  it('mapea el valor mayor a la Y más pequeña (Y invertida)', () => {
    const d = sparklinePath([10, 20], 100, 20, 2)
    // primer punto (10, el menor) abajo; segundo (20, el mayor) arriba
    expect(d).toBe('M2.00 18.00 L98.00 2.00')
  })

  it('con todos los valores iguales dibuja una línea horizontal centrada', () => {
    const d = sparklinePath([5, 5], 100, 20, 2)
    expect(d).toBe('M2.00 10.00 L98.00 10.00')
  })

  it('genera un comando por punto', () => {
    const d = sparklinePath([1, 2, 3], 100, 20)
    expect(d.match(/[ML]/g)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: FAIL — `Failed to load url ./sparkline` (el archivo no existe todavía).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/sparkline.ts`:

```ts
/** Sparkline de progresión: elige valores (1RM o peso) y genera el path SVG. */

import { buildProgressSeries } from './progress'
import type { SetLike, PesoFecha } from './stats'

/** 1RM si algún punto tiene reps; si no, peso máx. Valores en orden cronológico. */
export function sparklineSeries(
  setLogs: SetLike[],
  dayLogs: PesoFecha[],
): { values: number[]; metrica: 'oneRM' | 'pesoMax' } {
  const serie = buildProgressSeries(setLogs, dayLogs)
  const conRM = serie.filter((p) => p.oneRM != null)
  if (conRM.length > 0) {
    return { values: conRM.map((p) => p.oneRM as number), metrica: 'oneRM' }
  }
  return {
    values: serie.filter((p) => p.pesoMax != null).map((p) => p.pesoMax as number),
    metrica: 'pesoMax',
  }
}

/** `d` de un sparkline escalado a width×height (Y invertida). '' si <2 puntos. */
export function sparklinePath(
  values: number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const w = width - pad * 2
  const h = height - pad * 2
  const stepX = w / (values.length - 1)
  const x = (i: number) => pad + i * stepX
  const y = (v: number) =>
    max === min ? pad + h / 2 : pad + h - ((v - min) / (max - min)) * h
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sparkline.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sparkline.ts src/lib/sparkline.test.ts
git commit -m "Sparkline: logica pura (valores 1RM/peso + path SVG) con tests"
```

---

## Task 2: `components/exercise/Sparkline.tsx`

**Files:**
- Create: `src/components/exercise/Sparkline.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/exercise/Sparkline.tsx`:

```tsx
import { sparklinePath } from '../../lib/sparkline'

const ACCENT = '#a3e635'

interface Props {
  values: number[]
  width?: number
  height?: number
  className?: string
}

/** Sparkline SVG puro (sin Recharts). Devuelve null con menos de 2 puntos. */
export function Sparkline({ values, width = 56, height = 20, className }: Props) {
  const d = sparklinePath(values, width, height)
  if (!d) return null

  const pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const last = values[values.length - 1]
  const cx = width - pad
  const h = height - pad * 2
  const cy = max === min ? pad + h / 2 : pad + h - ((last - min) / (max - min)) * h

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={1.8} fill={ACCENT} />
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/exercise/Sparkline.tsx
git commit -m "Sparkline: componente SVG (linea + punto final)"
```

---

## Task 3: prop `bare` en `ExerciseProgressChart`

**Files:**
- Modify: `src/components/exercise/ExerciseProgressChart.tsx`

- [ ] **Step 1: Añadir la prop `bare` a la interfaz**

En `interface Props`, añade `bare`:

```tsx
interface Props {
  setLogs: SetLike[]
  dayLogs: PesoFecha[]
  bare?: boolean
}
```

Y en la firma del componente:

```tsx
export default function ExerciseProgressChart({ setLogs, dayLogs, bare = false }: Props) {
```

- [ ] **Step 2: Aplicar `bare` al estado vacío**

Reemplaza el bloque `if (serie.length === 0) { return (...) }` por:

```tsx
  if (serie.length === 0) {
    return (
      <div
        className={
          bare
            ? 'py-2 text-center'
            : 'rounded-xl border border-ink-border bg-ink-card px-4 py-6 text-center'
        }
      >
        <p className="text-sm leading-relaxed text-zinc-500">
          Registra series en el modo entrenamiento y aquí verás tu progresión.
        </p>
      </div>
    )
  }
```

- [ ] **Step 3: Aplicar `bare` a la tarjeta y a la cabecera**

Reemplaza la apertura del contenedor y la fila de cabecera. La versión actual es:

```tsx
    <div className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Progresión
        </p>
        <div className="flex gap-1">
```

Déjala así:

```tsx
    <div className={bare ? '' : 'rounded-xl border border-ink-border bg-ink-card px-4 py-3'}>
      <div className={`flex items-center gap-2 ${bare ? 'justify-end' : 'justify-between'}`}>
        {!bare && (
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Progresión
          </p>
        )}
        <div className="flex gap-1">
```

(No cambies el resto del cuerpo: selector de métrica, estados y gráfico se mantienen.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc -b`
Expected: sin errores. El uso actual desde `ExerciseSheet` (sin `bare`) sigue igual.

- [ ] **Step 5: Commit**

```bash
git add src/components/exercise/ExerciseProgressChart.tsx
git commit -m "ExerciseProgressChart: prop bare (sin tarjeta ni rotulo)"
```

---

## Task 4: unificar la gráfica de Progreso en el Dashboard

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Importar el componente**

Añade el import (junto a los demás imports de componentes):

```tsx
import ExerciseProgressChart from '../components/exercise/ExerciseProgressChart'
```

- [ ] **Step 2: Sustituir el gráfico manual por el componente**

Dentro del `Card` "Progresión de cargas", localiza el bloque del gráfico (el `<div className="mt-3 h-44">` con su `ResponsiveContainer`/`LineChart`/`seriePeso`) y sustitúyelo por:

```tsx
            <div className="mt-3">
              <ExerciseProgressChart
                bare
                setLogs={setRows.filter((r) => r.exercise_id === ejercicioSel)}
                dayLogs={edlRows.filter((r) => r.exercise_id === ejercicioSel)}
              />
            </div>
```

(El `<select>` de ejercicio y el título "Progresión de cargas" se quedan como están.)

- [ ] **Step 3: Eliminar la variable `seriePeso` (ya sin uso)**

Borra la línea:

```tsx
  const seriePeso = ejercicioSel ? (pesoPorEjercicio.get(ejercicioSel) ?? []) : []
```

`pesoPorEjercicio` y `PesoPunto` se MANTIENEN (los usa el `coach` y la construcción de `ejercicios`). Recharts sigue importándose (lo usan las gráficas de agua y sueño).

- [ ] **Step 4: Typecheck + build y comprobar chunks**

Run: `npm run build`
Expected: compila. En la salida, Recharts sigue en el chunk `LineChart` y `ExerciseProgressChart` NO aparece en el bundle de rutina. `npx tsc -b` sin errores (si `seriePeso` u otra variable quedara sin usar, tsc/eslint lo marcaría — elimínala).

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "Progreso: reutiliza ExerciseProgressChart (1RM/peso/volumen + PRs)"
```

---

## Task 5: sparkline en el modo entrenamiento

**Files:**
- Modify: `src/pages/WorkoutPage.tsx`

- [ ] **Step 1: Imports y estado**

Añade a los imports:

```tsx
import { sparklineSeries } from '../lib/sparkline'
import type { SetLike, PesoFecha } from '../lib/stats'
import { Sparkline } from '../components/exercise/Sparkline'
```

Junto al estado `histMax`, añade:

```tsx
  const [sparks, setSparks] = useState<
    Map<string, { values: number[]; metrica: 'oneRM' | 'pesoMax' }>
  >(new Map())
```

- [ ] **Step 2: Traer `reps_hechas` y construir el mapa de sparklines**

En el `useEffect` que carga `set_logs`/`exercise_day_logs`, cambia el `select` de `set_logs` para incluir `reps_hechas`:

```tsx
        supabase
          .from('set_logs')
          .select('exercise_id, fecha, reps_hechas, peso_usado')
          .lt('fecha', hoyStr),
```

Y, tras calcular `setHistMax(...)`, añade la construcción del mapa (reutiliza `sl.data`/`edl.data` ya cargados):

```tsx
      const setsByEx = new Map<string, SetLike[]>()
      for (const r of (sl.data ?? []) as SetLike[]) {
        const a = setsByEx.get(r.exercise_id) ?? []
        a.push(r)
        setsByEx.set(r.exercise_id, a)
      }
      const daysByEx = new Map<string, PesoFecha[]>()
      for (const r of (edl.data ?? []) as PesoFecha[]) {
        const a = daysByEx.get(r.exercise_id) ?? []
        a.push(r)
        daysByEx.set(r.exercise_id, a)
      }
      const sparkMap = new Map<string, { values: number[]; metrica: 'oneRM' | 'pesoMax' }>()
      for (const id of new Set([...setsByEx.keys(), ...daysByEx.keys()])) {
        sparkMap.set(id, sparklineSeries(setsByEx.get(id) ?? [], daysByEx.get(id) ?? []))
      }
      setSparks(sparkMap)
```

Nota: `edl.data` trae `peso` (no `peso_usado`); el `PesoFecha` casteado es correcto porque `exercise_day_logs` se selecciona como `exercise_id, fecha, peso`.

- [ ] **Step 3: Pintar el strip bajo el subtítulo**

Justo después del `<p>` con `grupo_muscular · objetivo … · descanso` (el que termina en `{item.descanso_seg}&Prime;`), añade:

```tsx
            {(() => {
              const s = sparks.get(item.exercise_id)
              if (!s || s.values.length < 2) return null
              return (
                <div className="mt-2 flex items-center gap-2">
                  <Sparkline values={s.values} width={110} height={30} />
                  <span className="text-xs text-zinc-500">
                    {s.metrica === 'oneRM' ? '1RM' : 'Peso'} ·{' '}
                    {s.values[s.values.length - 1]} kg
                  </span>
                </div>
              )
            })()}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: compila. Confirma en la salida que el bundle de entrenamiento (parte del `index` principal) NO incorpora Recharts (el sparkline es SVG puro).

- [ ] **Step 5: Commit**

```bash
git add src/pages/WorkoutPage.tsx
git commit -m "Entrenamiento: sparkline de progresion del ejercicio actual"
```

---

## Task 6: mini-trazos en las filas de la rutina

**Files:**
- Modify: `src/pages/RoutinePage.tsx`
- Modify: `src/components/routine/DayCard.tsx`

- [ ] **Step 1: RoutinePage — imports, estado y carga**

Añade a los imports de `RoutinePage.tsx`:

```tsx
import { useEffect } from 'react'
import { sparklineSeries } from '../lib/sparkline'
import type { SetLike, PesoFecha } from '../lib/stats'
```

(Si ya hay `import { useMemo, useState } from 'react'`, añade `useEffect` a esa línea en vez de duplicar el import.)

Dentro de `RoutinePage`, junto al resto de estados, añade:

```tsx
  const [sparklines, setSparklines] = useState<Map<string, number[]>>(new Map())

  useEffect(() => {
    if (!user) return
    void (async () => {
      const [sl, edl] = await Promise.all([
        supabase.from('set_logs').select('exercise_id, fecha, reps_hechas, peso_usado'),
        supabase.from('exercise_day_logs').select('exercise_id, fecha, peso'),
      ])
      const setsByEx = new Map<string, SetLike[]>()
      for (const r of (sl.data ?? []) as SetLike[]) {
        const a = setsByEx.get(r.exercise_id) ?? []
        a.push(r)
        setsByEx.set(r.exercise_id, a)
      }
      const daysByEx = new Map<string, PesoFecha[]>()
      for (const r of (edl.data ?? []) as PesoFecha[]) {
        const a = daysByEx.get(r.exercise_id) ?? []
        a.push(r)
        daysByEx.set(r.exercise_id, a)
      }
      const m = new Map<string, number[]>()
      for (const id of new Set([...setsByEx.keys(), ...daysByEx.keys()])) {
        m.set(id, sparklineSeries(setsByEx.get(id) ?? [], daysByEx.get(id) ?? []).values)
      }
      setSparklines(m)
    })()
  }, [user])
```

- [ ] **Step 2: RoutinePage — pasar el mapa a cada `DayCard`**

En el `.map` que renderiza `<DayCard ... />`, añade la prop:

```tsx
            sparklines={sparklines}
```

- [ ] **Step 3: DayCard — aceptar y propagar la prop**

En `DayCard.tsx`, añade a `interface Props`:

```tsx
  sparklines: Map<string, number[]>
```

Desestructúrala en la firma de `DayCard({ ... })` (añade `sparklines,` a la lista).

Importa el componente al principio del archivo:

```tsx
import { Sparkline } from '../exercise/Sparkline'
```

En el `.map` de `visibles` que crea `<SortableRow ... />`, pasa los valores:

```tsx
                    <SortableRow
                      key={it.id}
                      item={it}
                      dragEnabled={!soloPendientes}
                      sparkValues={sparklines.get(it.exercise_id) ?? []}
                      onOpen={() => onOpenItem(it)}
                      onPesoChanged={onPesoChanged}
                    />
```

- [ ] **Step 4: DayCard — renderizar el sparkline en la fila**

Cambia la firma de `SortableRow` para aceptar `sparkValues`:

```tsx
function SortableRow({
  item,
  dragEnabled,
  sparkValues,
  onOpen,
  onPesoChanged,
}: {
  item: RoutineItem
  dragEnabled: boolean
  sparkValues: number[]
  onOpen: () => void
  onPesoChanged: () => void
}) {
```

Y dentro del `<li>`, entre el `</button>` del nombre y `<PesoChip .../>`, inserta:

```tsx
      <Sparkline values={sparkValues} width={56} height={20} className="shrink-0" />
```

(Como `Sparkline` devuelve `null` con <2 puntos, las filas sin histórico quedan idénticas a ahora.)

- [ ] **Step 5: Typecheck + build (verificar bundle de rutina)**

Run: `npm run build`
Expected: compila. En la salida, el bundle principal/rutina NO incorpora Recharts ni `LineChart` por este cambio (el sparkline es SVG puro). `npx tsc -b` sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RoutinePage.tsx src/components/routine/DayCard.tsx
git commit -m "Rutina: mini-trazo de progresion en cada fila de ejercicio"
```

---

## Task 7: verificación en navegador

**Files:** (ninguno — verificación)

- [ ] **Step 1: Tests + build completos**

Run: `npx vitest run` → Expected: todo verde (63 previos + 8 nuevos = 71).
Run: `npm run build` → Expected: compila; Recharts solo en el chunk `LineChart`/`ExerciseProgressChart`.

- [ ] **Step 2: Sembrar datos de prueba (cuenta +prueba)**

Con el `preview_start` (dev server) y la cuenta `+prueba` ya logueada, sembrar histórico multi-fecha en un par de ejercicios vía el script Node local (autenticado con `mateosarias.josemiguel+prueba@gmail.com` / `prueba123`), p. ej. 8×22 → 10×22 → 12×22. (Sembrar por fetch desde el navegador lo bloquea el clasificador de auto-mode.)

- [ ] **Step 3: Verificar las 3 superficies**

- **Rutina** (`/rutina`): las filas de los ejercicios sembrados muestran el mini-trazo a la derecha, antes de "+kg"; las filas sin histórico, sin trazo. `read_page`/`javascript_exec` sobre los `<svg>`/`<path>` de las filas.
- **Entrenamiento** (`/entrenar`): si el día es de entreno, el ejercicio sembrado muestra el strip con el sparkline + "1RM · N kg". (Si el día es de descanso, se valida por build + código.)
- **Progreso** (`/progreso`): el bloque "Progresión de cargas" muestra el selector 1RM/Peso máx/Volumen + PRs (dots r=5) para el ejercicio sembrado; el `<select>` de ejercicio sigue cambiando la serie.

- [ ] **Step 4: Limpiar los datos sembrados**

Ejecutar el `clean` del script Node para borrar las filas sembradas. Confirmar cuenta de prueba limpia.

- [ ] **Step 5: Commit final (si hubo ajustes)**

Si la verificación obligó a algún arreglo, commitea. Si no, no hay nada que commitear.

---

## Self-review (hecho)

- **Cobertura del spec:** pieza compartida (Tasks 1-2), Parte 1 entrenamiento (Task 5), Parte 2 rutina (Task 6), Parte 3 unificar Progreso (Tasks 3-4), tests + navegador (Task 7). ✔
- **Sin placeholders:** todos los pasos con código real. ✔
- **Consistencia de tipos:** `sparklineSeries` → `{ values, metrica }`; `Sparkline` props `{ values, width?, height?, className? }`; `ExerciseProgressChart` prop `bare?`; `DayCard` prop `sparklines: Map<string, number[]>`; `SortableRow` prop `sparkValues: number[]`. Coinciden entre tareas. ✔
- **Bundle:** el sparkline es SVG puro → no añade Recharts a rutina/entrenamiento; `ExerciseProgressChart` en el Dashboard comparte el chunk de Recharts que ya carga Progreso. ✔
