# Celebración de "día perfecto" (4 pilares) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que salte una celebración (overlay con confeti que se auto-cierra) la primera vez que el día queda perfecto (los 4 pilares: ejercicio, dieta, sueño, agua), una sola vez al día.

**Architecture:** La Home detecta `dailyPoints(dia.log).perfect` y, si aún no se ha celebrado hoy (marca en `localStorage`), muestra `PerfectDayCelebration`. Helper puro para la clave/marca (`lib/perfectCelebration.ts`), keyframe de confeti en `tailwind.config.js`, componente de overlay autónomo con auto-cierre.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind. Tests con vitest (entorno node → cubre lo puro; el overlay y localStorage se verifican en navegador).

**Spec:** `docs/superpowers/specs/2026-07-13-celebracion-dia-perfecto-design.md`

---

## File Structure

- **Create** `src/lib/perfectCelebration.ts` — `celebracionKey` (puro) + `celebracionHecha`/`marcarCelebracion` (localStorage).
- **Create** `src/lib/perfectCelebration.test.ts` — test de `celebracionKey`.
- **Modify** `tailwind.config.js` — keyframe + animación `confeti`.
- **Create** `src/components/home/PerfectDayCelebration.tsx` — overlay con confeti + tarjeta + auto-cierre.
- **Modify** `src/pages/HomePage.tsx` — detectar día perfecto y mostrar el overlay una vez al día.

---

## Task 1: `lib/perfectCelebration.ts` — marca de celebración (TDD lo puro)

**Files:**
- Create: `src/lib/perfectCelebration.ts`
- Test: `src/lib/perfectCelebration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/perfectCelebration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { celebracionKey } from './perfectCelebration'

describe('celebracionKey', () => {
  it('combina el prefijo con la fecha', () => {
    expect(celebracionKey('2026-07-13')).toBe('habits:perfect-cel:2026-07-13')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/perfectCelebration.test.ts`
Expected: FAIL — `Failed to load url ./perfectCelebration`.

- [ ] **Step 3: Write implementation**

Create `src/lib/perfectCelebration.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/perfectCelebration.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfectCelebration.ts src/lib/perfectCelebration.test.ts
git commit -m "perfectCelebration: marca por dia de la celebracion (con test)"
```

---

## Task 2: keyframe de confeti + componente `PerfectDayCelebration`

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/components/home/PerfectDayCelebration.tsx`

- [ ] **Step 1: Añadir la keyframe y la animación `confeti` en `tailwind.config.js`**

En `theme.extend.keyframes`, añade `confeti` junto a las existentes (`halo`, etc.):

```js
        confeti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
```

Y en `theme.extend.animation`, añade:

```js
        confeti: 'confeti 2.8s linear forwards',
```

(Quedan como una entrada más dentro de los objetos `keyframes` y `animation` que ya existen.)

- [ ] **Step 2: Crear el componente**

Create `src/components/home/PerfectDayCelebration.tsx`:

```tsx
import { useEffect } from 'react'

// Piezas de confeti deterministas (posición X, retardo y color por pieza).
const COLORES = ['#a3e635', '#f4f4f5', '#84cc16', '#bef264']
const PIEZAS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 6.3 + (i % 3) * 4) % 100}%`,
  delay: `${(i % 5) * 0.15}s`,
  color: COLORES[i % COLORES.length],
}))

interface Props {
  puntos: number
  onClose: () => void
}

export function PerfectDayCelebration({ puntos, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-8 backdrop-blur-sm"
    >
      {/* Confeti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PIEZAS.map((p, i) => (
          <span
            key={i}
            className="animate-confeti absolute top-0 h-2.5 w-1.5 rounded-[1px]"
            style={{ left: p.left, animationDelay: p.delay, backgroundColor: p.color }}
          />
        ))}
      </div>

      {/* Tarjeta */}
      <div className="animate-fade-up relative flex flex-col items-center text-center">
        <svg viewBox="0 0 96 96" className="h-20 w-20">
          <circle
            cx="48" cy="48" r="42"
            fill="none" stroke="currentColor" strokeWidth="4"
            className="animate-draw-circle text-accent"
            strokeLinecap="round"
            strokeDasharray="264"
          />
          <path
            d="M32 50 l11 11 l21 -24"
            fill="none" stroke="currentColor" strokeWidth="6"
            strokeLinecap="round" strokeLinejoin="round"
            className="animate-draw-check text-accent"
            strokeDasharray="52"
          />
        </svg>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          ¡Día perfecto!
        </h1>
        <p className="mt-1 text-sm text-zinc-400">4/4 pilares</p>
        <p className="mt-4 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
          +{puntos} puntos hoy
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/components/home/PerfectDayCelebration.tsx
git commit -m "PerfectDayCelebration: overlay con confeti (auto-cierre) + keyframe confeti"
```

---

## Task 3: `HomePage` — disparar la celebración una vez al día

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Imports**

Añade a los imports de `HomePage.tsx`:

```tsx
import { celebracionHecha, marcarCelebracion } from '../lib/perfectCelebration'
import { PerfectDayCelebration } from '../components/home/PerfectDayCelebration'
```

(`useEffect`, `useState`, `dailyPoints` y `localDateStr` ya están importados en el archivo.)

- [ ] **Step 2: Estado + efecto de disparo**

Junto a los otros `useState` del componente, añade:

```tsx
  const [celebrar, setCelebrar] = useState(false)
```

Y, cerca de los demás `useEffect`, añade el que detecta el día perfecto:

```tsx
  // Celebra el día perfecto (4 pilares) una vez al día.
  useEffect(() => {
    const hoyStr = localDateStr()
    if (dailyPoints(dia.log).perfect && !celebracionHecha(hoyStr)) {
      marcarCelebracion(hoyStr)
      setCelebrar(true)
    }
  }, [dia.log])
```

- [ ] **Step 3: Renderizar el overlay**

Al final del componente, justo antes del cierre del `</div>` contenedor de la Home (el `<div className="flex flex-col gap-4">` que envuelve todo), añade:

```tsx
      {celebrar && (
        <PerfectDayCelebration
          puntos={puntos.points}
          onClose={() => setCelebrar(false)}
        />
      )}
```

(`puntos` = `dailyPoints(dia.log)` ya calculado en el componente; `puntos.points` incluye el bonus de día perfecto.)

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "Home: celebracion al completar los 4 pilares (una vez al dia)"
```

---

## Task 4: verificación en navegador

**Files:** (ninguno — verificación)

- [ ] **Step 1: Tests + build**

Run: `npx vitest run` → Expected: verde (86 previos + 1 nuevo = 87).
Run: `npm run build` → Expected: compila.

- [ ] **Step 2: Reiniciar el dev server**

Cambiar `tailwind.config.js` requiere reiniciar el server para que la clase `animate-confeti` se genere. Parar y volver a arrancar el preview (`dev`).

- [ ] **Step 3: Completar los 4 pilares y ver la celebración**

Con la cuenta `+prueba` en la Home: activar los 4 hábitos (toggles Ejercicio/Dieta + agua hasta el objetivo o toggle Hidratación + sueño ≥ objetivo o toggle Sueño). Al completar el 4º, debe aparecer el overlay "¡Día perfecto! · 4/4" con confeti, y auto-cerrarse a los ~3 s. Verificar con `read_page`/`javascript_exec` que aparece `.z-50` con el texto y las piezas `.animate-confeti`, y que existe la marca `habits:perfect-cel:<hoy>` en localStorage.

- [ ] **Step 4: No repetir**

Recargar la Home → **no** vuelve a saltar (marca puesta). Desmarcar un pilar y volver a marcarlo → no repite.

- [ ] **Step 5: Limpiar**

Quitar los 4 hábitos de la cuenta de prueba (o borrar el `daily_log` de hoy) y borrar la clave `habits:perfect-cel:<hoy>` de localStorage. Confirmar cuenta limpia.

---

## Self-review (hecho)

- **Cobertura del spec:** helper marca (Task 1), keyframe + componente overlay (Task 2), disparo en la Home una vez/día (Task 3), verificación (Task 4). ✔
- **Sin placeholders:** todos los pasos con código real. ✔
- **Consistencia de tipos:** `celebracionKey/celebracionHecha/marcarCelebracion(fecha)`; `PerfectDayCelebration({ puntos, onClose })`; `celebrar` boolean; `dailyPoints(dia.log).perfect`. Coinciden entre tareas. ✔
- **Bundle:** confeti en CSS/SVG propio; sin librerías nuevas. ✔
- **Gotcha:** tailwind.config cambia → reiniciar dev server antes de verificar (Task 4, Step 2). ✔
