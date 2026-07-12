# Diseño — Sparklines de progresión + unificar la gráfica de Progreso

Fecha: 2026-07-12 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

La gráfica de progresión por ejercicio (implementada en `188ddd7`/`21995e1`) solo se ve al abrir la ficha de un ejercicio. El usuario quiere el estímulo de la progresión **más a la vista**, en dos sitios más, y de paso **unificar** la gráfica del Dashboard (que hoy solo muestra peso máx) con la nueva (1RM/peso/volumen + PRs).

Son tres funciones que comparten una pieza nueva —un **sparkline en SVG puro**— más un refactor pequeño del chart existente.

## Estado actual (contexto)

- **`lib/progress.ts`**: `epley`, `buildProgressSeries(setLogs, dayLogs) → ProgressPoint[]` (ordenado por fecha, con `pesoMax|oneRM|volumen|mejorSet`), `marcarPRs`. Con 12 tests. Se reutiliza tal cual.
- **`components/exercise/ExerciseProgressChart.tsx`** (`export default`): Recharts `LineChart`, selector 1RM/Peso máx/Volumen (default 1RM), dot r=5 en PRs, tooltip. Envuelto en su propia tarjeta (`rounded-xl border … bg-ink-card`) con selector arriba. Se monta con `React.lazy` desde `ExerciseSheet`.
- **`pages/WorkoutPage.tsx`**: modo entrenamiento inmersivo. Ya carga en un `useEffect` todos los `set_logs` (`exercise_id, fecha, peso_usado`, `lt` hoy) + `exercise_day_logs` para calcular `histMax` (máximos previos para PRs). **NO** trae `reps_hechas`.
- **`pages/RoutinePage.tsx`** → renderiza `DayCard` por cada weekday. **`DayCard`** renderiza cada ejercicio en `SortableRow`, terminando en `PesoChip` (el "+kg"). RoutinePage hoy **no** carga histórico de cargas.
- **`pages/DashboardPage.tsx`** (Progreso): ya tiene en estado `setRows: SetLike[]` (todos los `set_logs` con reps) y `edlRows: PesoFecha[]` (todos los `exercise_day_logs`), más `exNames` y `pesoPorEjercicio` (usado por el `<select>` de ejercicio y por el `coach`). El bloque "Progresión de cargas" pinta un `LineChart` manual de solo peso máx. Recharts ya está en el chunk de Progreso (lazy a nivel de ruta).
- Convención: lógica pura en `src/lib/*.ts` con tests (vitest). 63 tests hoy.
- **Restricción de bundle**: la rutina y el entrenamiento NO deben cargar Recharts. Por eso los sparklines son **SVG propio**, sin dependencias.
- Acento verde lima `#a3e635`; MUTED `#71717a`.

## Pieza compartida — sparkline en SVG puro

- **`src/lib/sparkline.ts`** (nuevo, con `sparkline.test.ts`):
  - `sparklineSeries(setLogs, dayLogs): { values: number[]; metrica: 'oneRM' | 'pesoMax' }`
    Construye con `buildProgressSeries` y elige valores: si **algún** punto tiene `oneRM` no nulo → usa los `oneRM` de los puntos que lo tengan (métrica `'oneRM'`); si ninguno tiene reps → usa `pesoMax` de los puntos con peso (métrica `'pesoMax'`). Nunca mezcla escalas en una misma línea. Devuelve los valores en orden cronológico.
  - `sparklinePath(values: number[], width: number, height: number, pad?: number): string`
    Devuelve el `d` de un `<path>`. Escala X uniforme por índice y Y al rango `[min, max]` invertido (mayor arriba), con `pad` de margen (default 2). Casos: `values.length < 2` → `''` (cadena vacía); `min === max` → línea horizontal centrada verticalmente.
- **`src/components/exercise/Sparkline.tsx`** (nuevo): props `{ values: number[]; width?: number; height?: number; className?: string }`. Si `sparklinePath` da `''` (menos de 2 puntos) → devuelve `null`. Si no, `<svg>` con el `<path>` (línea, sin relleno, `stroke` acento, `strokeWidth` ~1.5, `strokeLinecap/Linejoin round`) y un `<circle>` en el último punto. Sin ejes, sin tooltip, sin Recharts.

## Parte 1 — Sparkline en el entrenamiento (`WorkoutPage.tsx`)

- La query de `set_logs` del `useEffect` existente añade `reps_hechas` al `select`.
- Se agrupan los registros por `exercise_id` (set_logs + day_logs) en un `Map<string, { setLogs, dayLogs }>` y, por ejercicio, se calcula `sparklineSeries`. Se guarda un `Map<string, { values, metrica }>` en estado (calculado una vez, memoizado).
- En la vista del ejercicio actual, bajo el subtítulo (`grupo · objetivo · descanso`), un strip pequeño (~130×34): `<Sparkline values={…} width={110} height={30} />` + etiqueta (`1RM` o `Peso` según `metrica`) y el último valor (`{last} kg`). Oculto si el `Sparkline` es `null` (<2 sesiones previas).
- No se toca la lógica de series/PR/volumen existente.

## Parte 2 — Mini-trazos en las filas de la rutina (`RoutinePage.tsx` + `DayCard.tsx`)

- **Carga de datos**: `RoutinePage` añade un `useEffect` que hace **una** consulta de todos los `set_logs` (`exercise_id, fecha, reps_hechas, peso_usado`) + todos los `exercise_day_logs` (`exercise_id, fecha, peso`) del usuario, los agrupa por `exercise_id` y calcula `sparklineSeries` por ejercicio → `Map<string, number[]>` (solo `values`; la métrica no se muestra en la fila). Se pasa a cada `DayCard`.
- **`DayCard`**: nueva prop `sparklines: Map<string, number[]>`; se propaga a `SortableRow`.
- **`SortableRow`**: entre el botón de nombre y `<PesoChip>`, renderiza `<Sparkline values={sparklines.get(item.exercise_id) ?? []} width={56} height={20} className="shrink-0" />`. Como `Sparkline` devuelve `null` con <2 puntos, las filas sin histórico quedan igual que ahora. No afecta al drag&drop (es un elemento no interactivo).
- Sin Recharts → el bundle de rutina no cambia de dependencias.

## Parte 3 — Unificar la gráfica de Progreso (`DashboardPage.tsx` + `ExerciseProgressChart.tsx`)

- **`ExerciseProgressChart`**: nueva prop `bare?: boolean` (default `false`). Con `bare`, no renderiza la tarjeta externa (`rounded-xl border … bg-ink-card`) ni el rótulo "Progresión" — solo el selector de métrica + el gráfico + estados. El uso actual desde `ExerciseSheet` no cambia (sigue con su tarjeta).
- **`DashboardPage`**: en el bloque "Progresión de cargas" se conserva el `<Card>`, su título y el `<select>` de ejercicio. Se sustituye el `LineChart` manual por:
  `<ExerciseProgressChart bare setLogs={setRows.filter(r => r.exercise_id === ejercicioSel)} dayLogs={edlRows.filter(r => r.exercise_id === ejercicioSel)} />`.
- Se puede eliminar el estado/variable `pesoPorEjercicio`→`seriePeso` **solo si** ya no se usa; pero `pesoPorEjercicio` lo consume también el `coach` y la construcción de `ejercicios`/`ejercicioSel`, así que **se mantiene** y solo se cambia el render del chart. `PesoPunto`/`seriePeso` que queden sin uso se retiran.
- Recharts ya está en el chunk de Progreso, así que importar `ExerciseProgressChart` directo (sin lazy) aquí no añade peso nuevo; comparte el chunk de `LineChart`.

## Arquitectura / archivos

Nuevos:
- `src/lib/sparkline.ts` + `src/lib/sparkline.test.ts`
- `src/components/exercise/Sparkline.tsx`

Editados:
- `src/pages/WorkoutPage.tsx` — `reps_hechas` en la query + `Map` de sparklines + strip bajo el subtítulo.
- `src/pages/RoutinePage.tsx` — carga histórico de todos los ejercicios + `Map` de valores → `DayCard`.
- `src/components/routine/DayCard.tsx` — prop `sparklines` → `SortableRow` con `<Sparkline>` antes de `PesoChip`.
- `src/components/exercise/ExerciseProgressChart.tsx` — prop `bare`.
- `src/pages/DashboardPage.tsx` — usa `ExerciseProgressChart bare` en vez del `LineChart` manual.

## Pruebas

- `sparkline.test.ts`:
  - `sparklinePath`: 2+ valores → `d` con el nº de puntos correcto y Y invertida (el valor mayor mapea a la Y más pequeña); `min===max` → línea horizontal a media altura; `<2` valores → `''`.
  - `sparklineSeries`: elige `oneRM` cuando hay reps (y descarta puntos sin oneRM); cae a `pesoMax` cuando ningún punto tiene reps; respeta el orden cronológico; sin datos → `values: []`.
- `npm run build` debe seguir mostrando Recharts **solo** en el chunk `LineChart`/`ExerciseProgressChart` (Progreso + ficha), no en el bundle principal ni en el de rutina.
- Verificación en navegador (cuenta `+prueba`, sembrando con el script Node local y limpiando después): mini-trazos en las filas con histórico, sparkline en el entrenamiento (requiere día de entreno), y el Dashboard con selector 1RM/peso/volumen + PRs.

## Fuera de alcance

- Reps/peso por serie individual (revierte la simplificación aprobada; descartado por el usuario).
- Tooltip/interacción en los sparklines (son indicadores, no gráficas).
- Cambiar la métrica de los sparklines (fija: 1RM con fallback a peso).

## Notas de implementación

- Sembrar en Supabase desde el navegador (fetch) lo **bloquea el clasificador de auto-mode**; usar un script Node local autenticado con las credenciales de la cuenta de prueba (`mateosarias.josemiguel+prueba@gmail.com` / `prueba123`), que sí pasa por el flujo de permisos. Limpiar los datos al terminar.
- Encoding: usar solo las tools Edit/Write (no `Get-Content`/`WriteAllText` de PowerShell sin UTF-8) para no corromper acentos.
- El día de la verificación puede ser de descanso (WorkoutPage sin ejercicios); en ese caso la Parte 1 se valida por tsc + código y las Partes 2 y 3 en vivo.
