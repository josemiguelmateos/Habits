# Persistir progreso del entrenamiento + completado en la Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el progreso a medias del entrenamiento (series marcadas, kg, reps por serie) sobreviva a salir/volver a `/entrenar`, y que la tarjeta "Hoy toca" de la Home muestre "Completado" cuando el entrenamiento del día está hecho.

**Architecture:** Un borrador local por usuario+día en `localStorage` (`lib/workoutDraft.ts`, pieza pura + envoltura fina), del que `WorkoutPage` inicializa su estado de forma síncrona al montar (posible porque `ProtectedRoute` garantiza `user`) y al que guarda en cada cambio. Al desmarcar una serie se borra su fila de `set_logs`. La Home deriva el estado "Completado" de `daily_log.exercise_done`.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase. Tests con vitest (entorno node → los tests cubren la lógica pura; el acceso a `localStorage` se verifica en navegador).

**Spec:** `docs/superpowers/specs/2026-07-13-persistir-progreso-entrenamiento-design.md`

---

## File Structure

- **Create** `src/lib/workoutDraft.ts` — tipo `WorkoutDraft`, `draftKey`, `parseDraft` (puros) + `loadDraft`/`saveDraft`/`pruneOldDrafts` (envuelven localStorage).
- **Create** `src/lib/workoutDraft.test.ts` — tests de `draftKey` y `parseDraft`.
- **Modify** `src/pages/WorkoutPage.tsx` — init del estado desde el borrador, efectos de prune/guardado, y borrado de `set_logs` al desmarcar.
- **Modify** `src/pages/HomePage.tsx` — tarjeta "Hoy toca" con estado "Completado".

---

## Task 1: `lib/workoutDraft.ts` — borrador local (TDD lo puro)

**Files:**
- Create: `src/lib/workoutDraft.ts`
- Test: `src/lib/workoutDraft.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/workoutDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { draftKey, parseDraft } from './workoutDraft'

describe('draftKey', () => {
  it('combina prefijo, userId y fecha', () => {
    expect(draftKey('u1', '2026-07-13')).toBe('habits:workout:u1:2026-07-13')
  })
})

describe('parseDraft', () => {
  it('devuelve null con null', () => {
    expect(parseDraft(null)).toBeNull()
  })

  it('devuelve null con JSON inválido', () => {
    expect(parseDraft('{no-json')).toBeNull()
  })

  it('devuelve null si el JSON no es un objeto', () => {
    expect(parseDraft('5')).toBeNull()
    expect(parseDraft('[]')).toBeNull()
  })

  it('hace round-trip de un borrador válido', () => {
    const d = {
      hechas: { e1: [true, false] },
      pesos: { e1: '20' },
      repsPorSerie: { e1: ['12', '8'] },
    }
    expect(parseDraft(JSON.stringify(d))).toEqual(d)
  })

  it('rellena con {} los sub-campos que falten o no sean objeto', () => {
    expect(parseDraft('{"hechas":{"e1":[true]}}')).toEqual({
      hechas: { e1: [true] },
      pesos: {},
      repsPorSerie: {},
    })
    expect(parseDraft('{"hechas":5,"pesos":"x"}')).toEqual({
      hechas: {},
      pesos: {},
      repsPorSerie: {},
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workoutDraft.test.ts`
Expected: FAIL — `Failed to load url ./workoutDraft`.

- [ ] **Step 3: Write implementation**

Create `src/lib/workoutDraft.ts`:

```ts
/** Borrador local del entrenamiento en curso (por usuario+día). */

export interface WorkoutDraft {
  hechas: Record<string, boolean[]>
  pesos: Record<string, string>
  repsPorSerie: Record<string, string[]>
}

const PREFIX = 'habits:workout:'

export function draftKey(userId: string, fecha: string): string {
  return `${PREFIX}${userId}:${fecha}`
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Parseo defensivo: null si raw es null/JSON inválido/no-objeto; sub-campos que falten → {}. */
export function parseDraft(raw: string | null): WorkoutDraft | null {
  if (raw == null) return null
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!esObjeto(obj)) return null
  return {
    hechas: esObjeto(obj.hechas) ? (obj.hechas as Record<string, boolean[]>) : {},
    pesos: esObjeto(obj.pesos) ? (obj.pesos as Record<string, string>) : {},
    repsPorSerie: esObjeto(obj.repsPorSerie)
      ? (obj.repsPorSerie as Record<string, string[]>)
      : {},
  }
}

export function loadDraft(userId: string, fecha: string): WorkoutDraft | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(userId, fecha)))
  } catch {
    return null
  }
}

export function saveDraft(userId: string, fecha: string, draft: WorkoutDraft): void {
  try {
    localStorage.setItem(draftKey(userId, fecha), JSON.stringify(draft))
  } catch {
    // almacenamiento no disponible o lleno: ignorar
  }
}

/** Borra los borradores de este usuario de otros días (deja solo el de `fecha`). */
export function pruneOldDrafts(userId: string, fecha: string): void {
  try {
    const conservar = draftKey(userId, fecha)
    const userPrefix = `${PREFIX}${userId}:`
    const aBorrar: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(userPrefix) && k !== conservar) aBorrar.push(k)
    }
    for (const k of aBorrar) localStorage.removeItem(k)
  } catch {
    // ignorar
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workoutDraft.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/workoutDraft.ts src/lib/workoutDraft.test.ts
git commit -m "workoutDraft: borrador local del entrenamiento (con tests)"
```

---

## Task 2: `WorkoutPage` — restaurar/guardar borrador + borrar set_log al desmarcar

**Files:**
- Modify: `src/pages/WorkoutPage.tsx`

- [ ] **Step 1: Importar los helpers**

Añade a los imports:

```tsx
import { loadDraft, saveDraft, pruneOldDrafts } from '../lib/workoutDraft'
```

- [ ] **Step 2: Inicializar el estado desde el borrador**

`ProtectedRoute` garantiza `user` en el primer render, así que se puede leer el borrador de forma síncrona. Sustituye las tres declaraciones de estado actuales:

```tsx
  const [hechas, setHechas] = useState<Record<string, boolean[]>>({})
  const [pesos, setPesos] = useState<Record<string, string>>({})
  const [repsPorSerie, setRepsPorSerie] = useState<Record<string, string[]>>({})
```

por:

```tsx
  const [hechas, setHechas] = useState<Record<string, boolean[]>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.hechas ?? {},
  )
  const [pesos, setPesos] = useState<Record<string, string>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.pesos ?? {},
  )
  const [repsPorSerie, setRepsPorSerie] = useState<Record<string, string[]>>(
    () => (user ? loadDraft(user.id, localDateStr()) : null)?.repsPorSerie ?? {},
  )
```

(`localDateStr` y `user` ya están disponibles en el componente; `localDateStr` está importado de `../lib/days`.)

- [ ] **Step 3: Efectos de limpieza y guardado**

Justo después del `useEffect` existente que carga `histMax`/`sparks` (el que termina con `}, [user])`), añade:

```tsx
  // Limpia borradores de días anteriores de este usuario.
  useEffect(() => {
    if (!user) return
    pruneOldDrafts(user.id, localDateStr())
  }, [user])

  // Guarda el progreso del día en cada cambio (restaura al volver a entrar).
  useEffect(() => {
    if (!user) return
    saveDraft(user.id, localDateStr(), { hechas, pesos, repsPorSerie })
  }, [user, hechas, pesos, repsPorSerie])
```

(El guardado inicial reescribe el mismo borrador que se acaba de cargar → inofensivo; no hay carrera porque el estado inicial ya es el borrador.)

- [ ] **Step 4: Borrar la fila de `set_logs` al desmarcar**

En `marcarSerie`, el bloque `if (valor) { … }` inserta al marcar. Añade un `else` que borre la fila al desmarcar. Localiza el cierre del `if (valor)` (la llave `}` tras el `.then(({ error }) => { … })` del insert) y conviértelo en:

```tsx
    } else {
      // Al desmarcar, retira la serie de set_logs para no ensuciar el historial.
      supabase
        .from('set_logs')
        .delete()
        .match({
          user_id: user!.id,
          exercise_id: it.exercise_id,
          fecha: localDateStr(),
          serie: serie + 1,
        })
        .then(({ error }) => {
          if (error) console.error('set_log del:', error.message)
        })
    }
```

Es decir, el `if (valor) { … }` pasa a `if (valor) { … } else { …delete… }`. No se cambia nada más de `marcarSerie`.

- [ ] **Step 5: Typecheck + build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/pages/WorkoutPage.tsx
git commit -m "Entrenamiento: persiste el progreso (borrador local) y limpia set_logs al desmarcar"
```

---

## Task 3: `HomePage` — tarjeta "Hoy toca" con estado Completado

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Derivar `completado`**

Junto a los otros derivados de la Home (p. ej. cerca de `const puntos = dailyPoints(dia.log)`), añade:

```tsx
  const entrenoCompletado = Boolean(dia.log?.exercise_done)
```

- [ ] **Step 2: Reflejarlo en la tarjeta "Hoy toca"**

En el `Link to="/entrenar"` de "Entrenamiento de hoy", sustituye el rótulo superior y el círculo de la derecha para que reflejen `entrenoCompletado`. Cambia el `<p>` "Hoy toca":

```tsx
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Hoy toca
              </p>
```

por:

```tsx
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {entrenoCompletado ? (
                  <span className="text-accent">Completado</span>
                ) : (
                  'Hoy toca'
                )}
              </p>
```

Y sustituye el `<span>` del icono de play:

```tsx
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-transform group-active:scale-95">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
```

por:

```tsx
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform group-active:scale-95 ${
                entrenoCompletado ? 'bg-accent/15 text-accent' : 'bg-accent text-accent-ink'
              }`}
            >
              {entrenoCompletado ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </span>
```

(Sigue siendo un `Link` a `/entrenar`; el título y el nº de ejercicios no cambian.)

- [ ] **Step 3: Typecheck + build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "Home: la tarjeta Hoy toca muestra Completado cuando el entreno esta hecho"
```

---

## Task 4: verificación en navegador

**Files:** (ninguno — verificación)

- [ ] **Step 1: Tests + build**

Run: `npx vitest run` → Expected: verde (80 previos + 6 nuevos = 86).
Run: `npm run build` → Expected: compila.

- [ ] **Step 2: Persistencia del progreso**

Con el dev server y la cuenta `+prueba` (hoy es día de entreno): en `/entrenar`, poner peso y editar reps de un par de series, marcar 2-3 series. Navegar a la Home (botón salir) y volver a `/entrenar`: los ticks, el peso y las reps por serie deben seguir ahí. Comprobar en `localStorage` que existe la clave `habits:workout:<userId>:<hoy>` con el estado (`javascript_exec`).

- [ ] **Step 3: Desmarcar borra de set_logs**

Marcar una serie, luego desmarcarla; consultar `set_logs` (script Node local) y confirmar que esa fila (serie) ya no está para hoy.

- [ ] **Step 4: Completado en la Home**

Completar el entrenamiento (pulsar "Terminar"); en la Home, la tarjeta "Hoy toca" debe mostrar "Completado" + el check en vez del play. Volver a `/entrenar`: siguen los ticks (borrador). `read_page`/`get_page_text` para confirmar.

- [ ] **Step 5: Limpiar**

Borrar los `set_logs` de hoy sembrados (script Node), resetear `daily_log.exercise_done` de hoy si procede, y limpiar la clave de `localStorage` de la cuenta de prueba. Confirmar cuenta limpia.

---

## Self-review (hecho)

- **Cobertura del spec:** borrador local (Task 1), restaurar/guardar + uncheck-delete (Task 2), Home completado (Task 3), verificación (Task 4). ✔
- **Sin placeholders:** todos los pasos con código real. ✔
- **Consistencia de tipos:** `WorkoutDraft { hechas, pesos, repsPorSerie }`; `draftKey(userId, fecha)`, `parseDraft(raw)`, `loadDraft/saveDraft/pruneOldDrafts(userId, fecha[, draft])` — usados igual en WorkoutPage. `entrenoCompletado` desde `dia.log?.exercise_done`. ✔
- **Sin carrera al montar:** el estado se inicializa síncronamente desde el borrador (ProtectedRoute garantiza `user`), así que el efecto de guardado no puede pisar el borrador con estado vacío. ✔
