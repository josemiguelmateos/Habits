# Diseño — Celebración de "día perfecto" (4 pilares)

Fecha: 2026-07-13 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

Cuando el usuario completa los **4 pilares del día** (ejercicio, dieta, sueño, agua) no pasa nada visible. Quiere que salte una **celebración** en ese momento como refuerzo.

## Estado actual (contexto)

- **`lib/score.ts` → `dailyPoints(log)`** devuelve `{ points, habitsDone, perfect }`; `perfect = habitsDone === 4` sobre `exercise_done, diet_done, sleep_done, hydration_done`. Ese es exactamente "los 4 pilares".
- **`HomePage.tsx`**: es el hub donde se completan los pilares (toggles de hábitos, anillo de agua que auto-marca `hydration_done`, input de sueño que auto-marca `sleep_done`). Usa `useDailyLog` → `dia.log`. Ya calcula `const puntos = dailyPoints(dia.log)`.
- **`components/workout/Celebration.tsx`**: overlay a pantalla completa tras "Terminar" entreno; acoplado a stats de la sesión (series, volumen, PRs). Reutiliza animaciones CSS `animate-halo`, `animate-draw-circle`, `animate-draw-check`, `animate-fade-up`.
- Convención: lógica pura en `src/lib/*.ts` con tests (vitest, entorno node → sin DOM). 86 tests hoy.
- El `exercise_done` (4º pilar) puede completarse en la Home (toggle) o en el entreno ("Terminar"); tras el entreno el usuario vuelve a la Home.

## Decisiones (aprobadas)

1. **Estilo: overlay con confeti que se auto-cierra** (~3 s, o al tocar). No a pantalla completa; no bloquea la Home.
2. **Dispara una vez al día**, la primera vez que la app observa el día como perfecto, vía marca en `localStorage`. Detección en la **Home**.
3. Sin sonido, sin compartir, sin celebración de rachas (fuera de alcance).

## Arquitectura / archivos

### `src/lib/perfectCelebration.ts` (nuevo, con `perfectCelebration.test.ts`)

- `celebracionKey(fecha: string): string` → `` `habits:perfect-cel:${fecha}` `` (puro, testeable).
- `celebracionHecha(fecha: string): boolean` → `localStorage.getItem(celebracionKey(fecha)) === '1'` (try/catch → false).
- `marcarCelebracion(fecha: string): void` → `localStorage.setItem(celebracionKey(fecha), '1')` (try/catch, ignora fallos).

### `src/components/home/PerfectDayCelebration.tsx` (nuevo)

- Props: `{ puntos: number; onClose: () => void }`.
- Overlay `fixed inset-0 z-50` con fondo semitransparente (`bg-ink/70 backdrop-blur-sm`); un clic en el overlay cierra.
- **Confeti**: ~16 piezas (`<span>` pequeños, colores lima/blanco/zinc), posición X y `animation-delay` calculados una vez con un array; caen/giran con una keyframe CSS nueva `confeti`. `pointer-events-none`.
- **Tarjeta central**: check animado (mismo SVG `draw-circle`/`draw-check` que `Celebration`), título "¡Día perfecto!", subtítulo "4/4 pilares", y los `puntos` del día ("+N puntos" o el bloque de puntos). Entrada con `animate-fade-up`.
- **Auto-cierre**: `useEffect` con `setTimeout(onClose, 3000)` (limpia el timeout al desmontar).

### `src/pages/HomePage.tsx` (editar)

- Estado `const [celebrar, setCelebrar] = useState(false)`.
- `useEffect` que observa `dia.log`: `const { perfect } = dailyPoints(dia.log)`; si `perfect && !celebracionHecha(localDateStr())` → `marcarCelebracion(hoyStr)` + `setCelebrar(true)`. (Deps: `[dia.log]`.)
- Render: al final del componente, `{celebrar && <PerfectDayCelebration puntos={puntos.points} onClose={() => setCelebrar(false)} />}`.

### CSS global (donde viven las animaciones existentes)

- Añadir la keyframe `confeti` (caída + rotación + leve fade) y su utilidad/clase, junto a `halo`/`draw-circle`/etc. (localizar el archivo que las define — `tailwind.config.*` o el CSS global de la app).

## Flujo de datos

Usuario completa el 4º pilar (Home o vuelve del entreno) → `dia.log` se actualiza → `useEffect` de la Home ve `perfect === true` y `!celebracionHecha(hoy)` → marca la celebración + muestra el overlay → confeti + tarjeta → auto-cierre a los 3 s. Recargar o volver a la Home ese día: `celebracionHecha(hoy)` es true → no repite. Día siguiente: clave nueva → puede volver a saltar.

## Pruebas

- `perfectCelebration.test.ts`: `celebracionKey('2026-07-13')` === `'habits:perfect-cel:2026-07-13'`. (Las envolturas de localStorage se cubren en navegador.)
- Navegador (cuenta +prueba): completar los 4 pilares (marcar los toggles / agua / sueño) → salta el overlay con confeti una vez; recargar la Home → **no** vuelve a saltar; desmarcar y re-marcar un pilar → no repite. Con <4 pilares no salta. Limpiar la marca de localStorage y el `daily_log` de prueba al terminar.
- `npm run build` + los 86 tests actuales verdes.

## Fuera de alcance

- Sonido / vibración.
- Compartir el día perfecto (social).
- Celebración especial por rachas de días perfectos (p. ej. 7 seguidos).
- Reutilizar/unificar con la `Celebration` del entrenamiento (son momentos distintos).

## Notas de implementación

- Sin migración.
- Confeti en CSS/SVG propio (sin librería) para no meter dependencias en el bundle.
- Encoding: solo tools Edit/Write.
- Verificación en navegador: capturas suelen dar timeout; usar `read_page`/`javascript_exec`. Los toggles de hábitos se pueden accionar por clic real; la marca vive en `localStorage`.
