# Diseño — Registrar reps reales + gráfica de progresión por ejercicio

Fecha: 2026-07-12 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

El usuario quiere ver, por cada ejercicio, una **gráfica de progresión del peso/esfuerzo en el tiempo** como estímulo para seguir empujando. Al analizarlo aparece un hueco previo que hay que tapar: **el modo entrenamiento solo captura el peso; las reps se guardan como las del objetivo, no las reales**. Sin reps reales no se puede registrar "8 reps × 22 kg" ni calcular una progresión significativa cuando subes reps a peso fijo.

Por tanto la función son **dos piezas que encajan**: (A) capturar reps reales al entrenar, (B) graficarlo en la ficha del ejercicio.

## Estado actual (contexto para implementar)

- **`WorkoutPage.tsx`** (modo entrenamiento): tiene un campo "Peso de hoy" por ejercicio (`pesos: Record<string,string>`) y checkboxes por serie. Al marcar una serie, `marcarSerie` inserta en `set_logs` con `peso_usado` = campo de peso y **`reps_hechas: parseInt(it.reps, 10)`** — es decir, las reps del OBJETIVO, no las hechas. También detecta PR por peso (`histMax`) y muestra un toast; calcula `volumenSesion` con las reps del objetivo.
- **Tabla `set_logs`** (migración 0001): `(user_id, exercise_id, fecha, serie, reps_hechas int, peso_usado numeric)`. **Ya tiene `reps_hechas`** → no hace falta migración.
- **Tabla `exercise_day_logs`** (0003): `(user_id, exercise_id, fecha, peso, notas)` — un peso por fecha, sin reps (viene del panel del calendario).
- **`ExerciseSheet.tsx`** (modal al tocar un ejercicio en la rutina): hoy carga `set_logs` (limit 24) y muestra `historyByDate` como **lista de texto** "Últimas sesiones" (nº series + peso máx por fecha). Aquí es donde va la gráfica.
- **`DashboardPage.tsx`** (Progreso): ya tiene una gráfica "Progresión de cargas" con selector de ejercicio (Recharts, peso máximo por fecha, fusionando `set_logs` + `exercise_day_logs`). Recharts se carga **lazy** solo en Progreso (chunk aparte). El bundle de rutina NO incluye Recharts — importante mantenerlo así.
- Convención del proyecto: lógica pura en `src/lib/*.ts` con **tests unitarios** (vitest). 51 tests hoy.

## Parte A — Registrar reps reales en el entrenamiento

En `WorkoutPage.tsx`, junto al campo "Peso de hoy" añadir un campo **"Reps de hoy"**:
- Nuevo estado `repsHechas: Record<string, string>` análogo a `pesos`.
- Valor por defecto = las reps del objetivo del ejercicio (`parseInt(item.reps)`; para objetivos tipo "12+12" usar el primer número). Editable a lo que se hizo (p. ej. 8).
- Al marcar una serie (`marcarSerie`), guardar en `set_logs`: `reps_hechas` = valor del campo "Reps de hoy" (no el objetivo), `peso_usado` = campo de peso. Como el usuario repite reps×peso en todas las series, un campo por ejercicio aplica a todas.
- El objetivo "4×12" sigue mostrándose arriba como referencia; no se modifica el plan (`routine_day_exercises.reps` se queda igual).
- Actualizar `volumenSesion` para usar las reps reales del campo en vez de las del objetivo.
- El toast de PR por peso se mantiene como está.
- **Persistencia opcional**: al escribir reps, no hace falta guardarlo en `routine_day_exercises` (eso es el objetivo, no lo real). Solo va a `set_logs` al marcar la serie.

## Parte B — Gráfica de progresión en la ficha del ejercicio

Sustituir la lista de texto "Últimas sesiones" del `ExerciseSheet` por una **gráfica de línea** con:

**Métricas** (selector de 3 botones, por defecto **1RM estimado**):
- **Peso máx** por sesión: `max(peso_usado)` de esa fecha. Fusiona `set_logs` + `exercise_day_logs` (como Progreso).
- **1RM estimado** (Epley): por sesión, `max` sobre las series de `peso × (1 + reps/30)`. Requiere reps → solo `set_logs`. Es la métrica por defecto porque refleja la progresión de reps a peso fijo (8→10→12 reps a 22 kg = línea que sube).
- **Volumen** por sesión: `Σ (peso × reps)` de esa fecha. Requiere reps → solo `set_logs`.

**Récords (PR)**: sobre la métrica seleccionada, marcar cada punto que sea un nuevo máximo histórico hasta esa fecha (punto lima más grande + tooltip "PR").

**Estados**: cargando (spinner); sin datos ("Registra series en el modo entrenamiento y aquí verás tu progresión"); si una métrica concreta no tiene datos (p. ej. solo registraste kg por el calendario, sin reps) → aviso de que 1RM/volumen necesitan reps del entrenamiento.

## Arquitectura / archivos

- **`src/lib/progress.ts`** (nuevo, con `progress.test.ts`):
  - `epley(peso, reps): number` → `peso * (1 + reps/30)`.
  - `buildProgressSeries(setLogs, dayLogs)` → array ordenado por fecha de `{ fecha, pesoMax, oneRM|null, volumen|null, mejorSet: {peso,reps}|null }`. Agrupa `set_logs` por fecha; fusiona `exercise_day_logs` en `pesoMax`.
  - `marcarPRs(puntos, metrica)` → añade `isPR` a cada punto según el máximo acumulado de esa métrica.
- **`src/components/exercise/ExerciseProgressChart.tsx`** (nuevo): props `{ setLogs, dayLogs }` o `{ exerciseId }`. Selector de métrica, Recharts `LineChart` con dot personalizado (más grande/acento si `isPR`), tooltip con fecha + valor + (reps×peso del día si aplica). **Se importa con `React.lazy` + `Suspense`** desde `ExerciseSheet` para que Recharts NO entre en el bundle de rutina (se descarga al abrir la primera ficha).
- **`src/components/routine/ExerciseSheet.tsx`** (editar): cargar TODO el histórico del ejercicio (`set_logs` sin limit + `exercise_day_logs` filtrado por `exercise_id`), pasarlo a `ExerciseProgressChart` (lazy) en el lugar de `historyByDate`. Se puede conservar un resumen mínimo de últimas sesiones debajo, o eliminarlo (la gráfica lo cubre).
- **`src/pages/WorkoutPage.tsx`** (editar): añadir campo "Reps de hoy" + estado `repsHechas`, usarlo en `marcarSerie` y `volumenSesion`.

## Pruebas

- `progress.test.ts`: Epley, `buildProgressSeries` (agrupación por fecha, fusión de day_logs solo en pesoMax, 1RM/volumen null sin reps), `marcarPRs`. **Regla de PR (explícita)**: un punto es PR si su valor es estrictamente mayor que el máximo de TODOS los puntos anteriores. El primer punto NO es PR (es la línea base, no hay récord previo que batir); esto coincide con la lógica del toast del entrenamiento, que exige un máximo previo.
- Verificación en navegador: sembrar set_logs (8×22, 10×22, 12×22) → abrir ficha → 1RM sube, PRs marcados; cambiar a peso máx (plano) y volumen (sube). Probar en el entrenamiento que "Reps de hoy" editable se guarda en `set_logs.reps_hechas`.

## Fuera de alcance (anotado para el futuro)

- Sparkline del ejercicio actual durante el entrenamiento.
- Mini-trazos en las filas de la lista de rutina.
- Reps/peso por serie individual (ahora es un valor por ejercicio aplicado a todas las series).
- Mejorar/unificar la gráfica de Progreso con esta.

## Notas de implementación

- Cuenta de prueba: `mateosarias.josemiguel+prueba@gmail.com` / `prueba123` (tiene la rutina de ejemplo de 38 ejercicios). Verificar con set_logs sembrados y limpiar después.
- El chart lazy debe mantener el bundle de rutina sin Recharts — comprobar en el build que sale un chunk separado.
- Acento de la app: verde lima `#a3e635` (mismo que la gráfica de Progreso: ACCENT `#a3e635`, GRID `#2a2a32`, MUTED `#71717a`).
