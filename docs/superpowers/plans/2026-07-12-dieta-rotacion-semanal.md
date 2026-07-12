# Dieta: rotación semanal de opciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al importar una dieta con opciones, generar N semanas (2-4) distintas y que la app muestre automáticamente la semana que toca por calendario, con un selector para previsualizar el resto; la lista de la compra sigue la semana seleccionada.

**Architecture:** Una columna `semana` en `diet_meals` (NULL = comida fija/todas las semanas; 1..N = solo esa semana). `N` se deriva de `max(semana)`. La semana activa se calcula con el número de semana ISO (`lib/days.ts`). El prompt de import y el validador aceptan `semana`; `useDiet` filtra por semana y `DietPage` estrena un selector de semana.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase (Postgres/RLS). Import con IA vía Edge Function. Tests con vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-dieta-rotacion-semanal-design.md`

---

## File Structure

- **Modify** `src/lib/days.ts` — `isoWeekNumber()` y `semanaActiva()`. Puro.
- **Create** `src/lib/days.test.ts` — tests de ambas.
- **Create** `supabase/migrations/0006_diet_semana.sql` — columna `semana` (la aplica el usuario a mano).
- **Modify** `src/types.ts` — `DietMeal.semana`.
- **Modify** `src/lib/importDiet.ts` — `JsonMeal.semana` + validación + inserción.
- **Create** `src/lib/importDiet.test.ts` — tests de la validación de `semana`.
- **Modify** `src/lib/importPrompts.ts` — `PROMPT_DIETA` (regla de semanas).
- **Modify** `src/hooks/useDiet.ts` — `semanas`, `mealsForDay(weekday, semana?)`, `shoppingItemsForWeek(semana?)`.
- **Modify** `src/pages/DietPage.tsx` — selector de semana + cableado.
- **Modify** `src/components/diet/ShoppingListSheet.tsx` — etiqueta de semana (opcional).

---

## Task 1: helpers de semana ISO en `lib/days.ts` (TDD)

**Files:**
- Modify: `src/lib/days.ts`
- Test: `src/lib/days.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/days.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isoWeekNumber, semanaActiva } from './days'

describe('isoWeekNumber', () => {
  it('el 1 de enero de 2026 (jueves) es la semana 1', () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1)
  })

  it('el 4 de enero de 2021 (lunes) es la semana 1', () => {
    expect(isoWeekNumber(new Date(2021, 0, 4))).toBe(1)
  })

  it('el 3 de enero de 2021 (domingo) pertenece a la semana 53 de 2020', () => {
    expect(isoWeekNumber(new Date(2021, 0, 3))).toBe(53)
  })

  it('el 8 de enero de 2026 es la semana 2', () => {
    expect(isoWeekNumber(new Date(2026, 0, 8))).toBe(2)
  })
})

describe('semanaActiva', () => {
  it('con 1 semana (o menos) siempre devuelve 1', () => {
    expect(semanaActiva(1, new Date(2026, 0, 8))).toBe(1)
    expect(semanaActiva(0, new Date(2026, 0, 8))).toBe(1)
  })

  it('rota ((semanaISO-1) % N) + 1', () => {
    expect(semanaActiva(3, new Date(2026, 0, 1))).toBe(1) // semana ISO 1
    expect(semanaActiva(3, new Date(2026, 0, 8))).toBe(2) // semana ISO 2
    expect(semanaActiva(3, new Date(2026, 0, 15))).toBe(3) // semana ISO 3
    expect(semanaActiva(3, new Date(2026, 0, 22))).toBe(1) // semana ISO 4 -> 1
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/days.test.ts`
Expected: FAIL — `isoWeekNumber`/`semanaActiva` no existen.

- [ ] **Step 3: Write minimal implementation**

Añade al final de `src/lib/days.ts`:

```ts
/** Número de semana ISO 8601 (1-53) a partir de una fecha local. */
export function isoWeekNumber(d: Date = new Date()): number {
  // Trabaja en UTC con la fecha local (año/mes/día) para evitar líos de zona.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = (date.getUTCDay() + 6) % 7 // 0=lunes … 6=domingo
  date.setUTCDate(date.getUTCDate() - day + 3) // jueves de esta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** Semana del ciclo (1..semanas) según la semana ISO. Con semanas<=1 → 1. */
export function semanaActiva(semanas: number, d: Date = new Date()): number {
  if (semanas <= 1) return 1
  return ((isoWeekNumber(d) - 1) % semanas) + 1
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/days.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/days.ts src/lib/days.test.ts
git commit -m "days: numero de semana ISO + semana activa del ciclo (con tests)"
```

---

## Task 2: migración `0006_diet_semana.sql`

**Files:**
- Create: `supabase/migrations/0006_diet_semana.sql`

- [ ] **Step 1: Crear el archivo de migración**

Create `supabase/migrations/0006_diet_semana.sql`:

```sql
-- 0006: rotación semanal de opciones en la dieta.
-- semana NULL = comida fija (aparece todas las semanas del ciclo);
-- semana = 1..N = comida que solo aparece en esa semana del ciclo.
-- Las dietas ya importadas quedan todas NULL => 1 semana efectiva (sin cambios).
alter table diet_meals add column if not exists semana smallint;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0006_diet_semana.sql
git commit -m "Migracion 0006: columna semana en diet_meals"
```

> **Nota:** el usuario aplica la migración a mano en el SQL Editor de Supabase (no hay CLI conectada). El código degrada bien si aún no está aplicada: `select('*')` no falla por una columna ausente y `semana` se trata como `null` (comida fija) → 1 semana. La verificación en navegador (Task 8) requiere que la columna exista.

---

## Task 3: tipos — `DietMeal.semana`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Añadir el campo**

En `interface DietMeal`, añade `semana` (tras `descripcion`):

```ts
export interface DietMeal {
  id: string
  user_id: string
  dias: number[]
  slot: string
  orden: number
  descripcion: string
  semana: number | null
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: puede fallar en `importDiet.ts`/`useDiet.ts` hasta completar las siguientes tareas; si solo falla ahí, continúa. (Si prefieres, commitea junto con Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Tipos: DietMeal.semana"
```

---

## Task 4: validación e inserción de `semana` en `importDiet.ts` (TDD)

**Files:**
- Modify: `src/lib/importDiet.ts`
- Test: `src/lib/importDiet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/importDiet.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/importDiet.test.ts`
Expected: FAIL — hoy `semana` no se parsea (será `undefined`, no `null`/número; y no rechaza `0`).

- [ ] **Step 3: Implementar**

En `src/lib/importDiet.ts`:

(a) Añade `semana` a la interfaz `JsonMeal`:

```ts
export interface JsonMeal {
  dias: number[]
  slot: string
  orden?: number
  descripcion: string
  semana?: number | null
  items?: JsonMealItem[]
}
```

(b) Dentro de `validateDietaJson`, en el bucle de comidas, **después** de validar `descripcion` y **antes** del `comidas.push(...)`, añade:

```ts
    let semana: number | null = null
    if (m.semana != null && m.semana !== '') {
      const s = Number(m.semana)
      if (!Number.isInteger(s) || s < 1) {
        return {
          ok: false,
          error: `Comida nº${i + 1}: "semana" debe ser un entero ≥ 1 (o quítala si es fija).`,
        }
      }
      semana = s
    }
```

(c) Incluye `semana` en el objeto que se hace `push`:

```ts
    comidas.push({
      dias,
      slot: m.slot.trim(),
      orden: Number(m.orden) || i + 1,
      descripcion: m.descripcion.trim(),
      semana,
      items,
    })
```

(d) En `importDietData`, añade `semana` a `mealRows`:

```ts
  const mealRows = data.comidas.map((c) => ({
    user_id: userId,
    dias: c.dias,
    slot: c.slot,
    orden: c.orden ?? 0,
    descripcion: c.descripcion,
    semana: c.semana ?? null,
  }))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/importDiet.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/importDiet.ts src/lib/importDiet.test.ts
git commit -m "Import dieta: acepta y guarda semana (con tests)"
```

---

## Task 5: prompt de import — `PROMPT_DIETA`

**Files:**
- Modify: `src/lib/importPrompts.ts`

- [ ] **Step 1: Añadir `semana` al esquema y la regla de semanas**

En `PROMPT_DIETA`, dentro de la sección "Reglas del esquema", añade una viñeta para `semana` (junto a las de `dias`/`slot`/`orden`):

```
- "semana" (opcional): número de semana del ciclo (1, 2, 3…) para las comidas que ROTAN entre semanas. Omítela (o null) en las comidas fijas que se repiten todas las semanas.
```

Y **amplía** la "REGLA CLAVE — comidas con opciones" para que reparta las opciones ENTRE SEMANAS, añadiendo al final de esa sección:

```
ROTACIÓN SEMANAL (además de la variedad diaria):
- Si hay opciones suficientes, genera entre 2 y 4 SEMANAS distintas y reparte las opciones entre ellas, de modo que cada semana use elecciones diferentes (no la misma dieta cada semana). Marca cada comida que rote con "semana": 1, 2, 3… según la semana del ciclo a la que pertenece.
- Las comidas fijas (menú único, sin opciones) van SIN "semana" (valen para todas las semanas): no las repitas en cada semana.
- Si la dieta no tiene opciones, no uses "semana" en ninguna comida (una sola semana).
- Mantén además la variedad día a día dentro de cada semana, como ya se indica arriba.
```

También añade `"semana"` al ejemplo de comida del esquema si lo hubiera (una comida con `"semana": 1`), para que el modelo vea el campo.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sin errores (es solo texto en una constante).

- [ ] **Step 3: Commit**

```bash
git add src/lib/importPrompts.ts
git commit -m "Prompt dieta: repartir opciones en 2-4 semanas (campo semana)"
```

---

## Task 6: `useDiet` — semana activa y filtrado por semana

**Files:**
- Modify: `src/hooks/useDiet.ts`

- [ ] **Step 1: Importar `semanaActiva`**

Añade a los imports:

```ts
import { semanaActiva } from '../lib/days'
```

- [ ] **Step 2: Derivar `semanas` y filtrar por semana**

Sustituye el bloque actual de `mealsForDay` + `shoppingItems` por:

```ts
  const semanas = useMemo(
    () => Math.max(1, meals.reduce((n, m) => Math.max(n, m.semana ?? 0), 0)),
    [meals],
  )

  const mealsForDay = useCallback(
    (weekday: number, semana?: number) => {
      const sem = semana ?? semanaActiva(semanas)
      return meals
        .filter((m) => m.dias.includes(weekday) && (m.semana == null || m.semana === sem))
        .sort((a, b) => a.orden - b.orden)
    },
    [meals, semanas],
  )

  /** Items de la compra de una semana (comidas fijas + las de esa semana). */
  const shoppingItemsForWeek = useCallback(
    (semana?: number): ItemConDias[] => {
      const sem = semana ?? semanaActiva(semanas)
      return meals
        .filter((m) => m.semana == null || m.semana === sem)
        .flatMap((m) =>
          m.items.map((it) => ({
            nombre: it.nombre,
            categoria: it.categoria,
            cantidad: it.cantidad,
            unidad: it.unidad,
            dias: m.dias,
          })),
        )
    },
    [meals, semanas],
  )
```

- [ ] **Step 3: Actualizar el return**

Cambia la línea de `return { ... }` por:

```ts
  return {
    meals,
    meta,
    loading,
    missing,
    isEmpty,
    semanas,
    mealsForDay,
    shoppingItemsForWeek,
    reload: load,
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: fallará en `DietPage.tsx` (usa `shoppingItems`); se arregla en Task 7. `HomePage.tsx` (`mealsForDay(hoy)`) sigue compilando porque `semana` es opcional.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDiet.ts
git commit -m "useDiet: semanas + filtrado por semana (default: semana activa)"
```

---

## Task 7: `DietPage` — selector de semana + lista de la compra por semana

**Files:**
- Modify: `src/pages/DietPage.tsx`
- Modify: `src/components/diet/ShoppingListSheet.tsx`

- [ ] **Step 1: Import y estado de semana**

En `DietPage.tsx`, amplía el import de `days` y añade `useEffect`:

```ts
import { useEffect, useState } from 'react'
import { isoWeekday, WEEKDAY_NAMES, semanaActiva } from '../lib/days'
```

Junto a `const [diaSel, setDiaSel] = useState(hoy)`, añade:

```tsx
  const [semanaSel, setSemanaSel] = useState(1)

  // Al cargar (o cambiar el nº de semanas), sitúate en la semana que toca por calendario.
  useEffect(() => {
    setSemanaSel(semanaActiva(dieta.semanas))
  }, [dieta.semanas])
```

- [ ] **Step 2: Selector de semana (solo si hay ≥2)**

Justo **antes** del bloque `{/* Selector de día */}` (el `<div className="grid grid-cols-7 gap-1">`), añade:

```tsx
      {dieta.semanas >= 2 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Semana
          </span>
          <div className="flex gap-1">
            {Array.from({ length: dieta.semanas }, (_, i) => i + 1).map((w) => {
              const activa = w === semanaActiva(dieta.semanas)
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setSemanaSel(w)}
                  aria-pressed={semanaSel === w}
                  className={`rounded-lg px-3 py-1.5 font-display text-xs font-semibold transition-colors ${
                    semanaSel === w
                      ? 'bg-accent text-accent-ink'
                      : activa
                        ? 'bg-ink-raised text-accent'
                        : 'bg-ink-raised text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {w}
                </button>
              )
            })}
          </div>
          <span className="text-[11px] text-zinc-600">rota cada semana</span>
        </div>
      )}
```

- [ ] **Step 3: Usar la semana en las comidas del día y en la lista**

Cambia:

```tsx
  const comidasDia = dieta.mealsForDay(diaSel)
```

por:

```tsx
  const comidasDia = dieta.mealsForDay(diaSel, semanaSel)
```

Y en `<ShoppingListSheet ... />` cambia el `items` y pasa la semana:

```tsx
      <ShoppingListSheet
        open={compraAbierta}
        items={dieta.shoppingItemsForWeek(semanaSel)}
        semana={dieta.semanas >= 2 ? semanaSel : undefined}
        onClose={() => setCompraAbierta(false)}
      />
```

- [ ] **Step 4: Etiqueta de semana en `ShoppingListSheet`**

En `src/components/diet/ShoppingListSheet.tsx`, añade `semana` a `Props`:

```tsx
interface Props {
  open: boolean
  items: ItemConDias[]
  semana?: number
  onClose: () => void
}
```

Desestructúrala y muéstrala en el subtítulo. Cambia la firma:

```tsx
export function ShoppingListSheet({ open, items, semana, onClose }: Props) {
```

Y el texto del subtítulo:

```tsx
          <p className="text-sm text-zinc-500">
            Bruto para toda la semana{semana != null ? ` · Semana ${semana}` : ''} · {hechos}/
            {total}
          </p>
```

- [ ] **Step 5: Typecheck + build**

Run: `npm run build`
Expected: compila sin errores (ya no queda ninguna referencia a `dieta.shoppingItems`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/DietPage.tsx src/components/diet/ShoppingListSheet.tsx
git commit -m "Dieta: selector de semana + lista de la compra por semana"
```

---

## Task 8: verificación en navegador

**Files:** (ninguno — verificación; requiere que el usuario haya aplicado la migración 0006)

- [ ] **Step 1: Tests + build**

Run: `npx vitest run` → Expected: todo verde (63 previos + 6 de days + 3 de importDiet = 72).
Run: `npm run build` → Expected: compila.

- [ ] **Step 2: Confirmar migración aplicada**

La columna `diet_meals.semana` debe existir (la aplica el usuario con `0006_diet_semana.sql`). Si no está, la verificación de rotación no es posible (la app trataría todo como 1 semana).

- [ ] **Step 3: Importar una dieta con semanas (cuenta +prueba)**

Con el dev server y la cuenta `+prueba`: desde la pestaña Dieta → "Importar archivo (PDF, Excel o JSON)" pega un JSON con comidas `semana: 1/2/3` (p. ej. una comida fija sin semana + una "Comida" distinta para semana 1, 2 y 3). Alternativa: sembrar `diet_meals` con `semana` vía el script Node local (autenticado con las credenciales de prueba; sembrar por fetch del navegador lo bloquea el clasificador). Limpiar al terminar.

- [ ] **Step 4: Verificar**

- Aparece el selector "Semana 1·2·3" con la semana del calendario resaltada.
- Cambiar de semana cambia las comidas del día (`read_page`/`get_page_text` sobre las `MealCard`).
- La "Lista de la compra" muestra "· Semana N" y sus cantidades cambian con la semana.
- Importar una dieta SIN `semana` (todo null) → no aparece selector, comportamiento idéntico al actual.

- [ ] **Step 5: Limpiar**

Borrar la dieta de prueba (botón "Borrar dieta e importar otra" o `clean` del script). Confirmar cuenta de prueba limpia.

---

## Self-review (hecho)

- **Cobertura del spec:** helpers de semana (Task 1), migración (Task 2), tipo (Task 3), validación/inserción (Task 4), prompt (Task 5), hook (Task 6), vista + lista (Task 7), verificación (Task 8). ✔
- **Sin placeholders:** todos los pasos con código real. ✔
- **Consistencia de tipos:** `DietMeal.semana: number | null`; `JsonMeal.semana?: number | null`; `useDiet` expone `semanas`, `mealsForDay(weekday, semana?)`, `shoppingItemsForWeek(semana?)`; `ShoppingListSheet` prop `semana?: number`. `HomePage` sigue llamando `mealsForDay(hoy)` (semana opcional → semana activa). ✔
- **Retrocompat:** dietas sin `semana` → `semanas = 1` → sin selector, filtro `m.semana == null` incluye todo = comportamiento actual. Código degrada bien si la migración aún no está aplicada. ✔
