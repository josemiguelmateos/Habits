# Diseño — Defaults de la última sesión + coach de progresión en el entrenamiento

Fecha: 2026-07-13 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

En el modo entrenamiento, los valores por defecto no ayudan a superarse:

- Las **reps por serie** salen siempre con el objetivo del plan (p. ej. 12), no con lo que hiciste la última vez (12·12·8·8). El **peso** sí persiste (se guarda en el plan al escribirlo), pero aparece como placeholder gris, no como valor.
- El **coach** ya sabe cuándo toca subir peso (doble progresión en `lib/coach.ts`), pero solo lo muestra en Progreso y con datos débiles (`repsOk` siempre true). No lo dice **donde importa: en el ejercicio, mientras entrenas**.

Objetivo: que cada ejercicio abra con **lo que hiciste la última vez** (para batirlo) y que el coach recomiende **subir o bajar peso ahí mismo**, con feedback por serie de si te superaste.

## Estado actual (contexto)

- **`WorkoutPage.tsx`**: carga en un `useEffect` todos los `set_logs` previos (`exercise_id, fecha, reps_hechas, peso_usado`, `.lt('fecha', hoy)`) para `histMax` y sparklines. Inputs: "Peso de hoy" (`value = pesos[item.id] ?? ''`, placeholder `item.peso`; al blur `guardarPeso` actualiza `routine_day_exercises.peso`) y reps por serie (`value = repsPorSerie[item.id]?.[s] ?? objetivo`). `marcarSerie` inserta/borra en `set_logs` con `repsDeSerie` y el peso (fallback `pesos[item.id] ?? item.peso`). Borrador local (`workoutDraft`) restaura `hechas/pesos/repsPorSerie` del día.
- **`lib/coach.ts`**: `SesionPeso { fecha, peso, repsOk }`; `sugerenciaProgresion(nombre, sesiones, paso=2.5)` → string: subir si las 2 últimas sesiones mismo peso cumpliendo; bajar si 4+ sesiones al mismo peso y las 2 últimas sin cumplir. 5 tests.
- **`DashboardPage.tsx`**: memo `coach` llama `sugerenciaProgresion` con **`repsOk: true` fijo** (no había reps reales). `generarIA` construye un objeto `resumen` y lo envía a la Edge Function vía `pedirAnalisisIA(resumen)`; la función lo incrusta tal cual en el prompt → **añadir claves al resumen no requiere redesplegar la función**.
- **`set_logs`**: fila por serie (`serie`, `reps_hechas`, `peso_usado`) — desde el 2026-07-13 con reps reales por serie y borrado al desmarcar.
- Un ejercicio puede estar en varios días del plan (p. ej. Crunch martes y viernes) con objetivos normalmente idénticos.
- Convención: lógica pura en `src/lib/*.ts` con tests (vitest). 87 tests hoy.

## Decisiones (aprobadas)

1. **Inputs rellenados con la última sesión + línea fija "Última vez: 12·12·8·8 × 20 kg"** (no cambia al editar). Prioridad de defaults: **borrador de hoy → última sesión → objetivo del plan**.
2. **Chip del coach con "Aplicar"** en el ejercicio: subir (lima, "⚡ Sube a X kg — 2 sesiones cumpliendo") y **también bajar** (ámbar, "↓ Baja a X kg — N sesiones sin cerrar las reps"). "Aplicar" rellena el peso y lo persiste en el plan; el chip desaparece al aplicar.
3. **Colores serie a serie**: al marcar una serie, su input de reps se tiñe respecto a la última sesión (verde = superaste esa serie, ámbar = por debajo, estilo actual = igual o sin referencia).
4. **IA**: la decisión del entrenamiento es **regla local** (instantánea, gratis). El **análisis IA de Progreso** se enriquece con la progresión por ejercicio (últimas sesiones con reps reales + lo que dice la regla), sin tocar la Edge Function.

## Arquitectura / archivos

### `src/lib/lastSession.ts` (nuevo, con `lastSession.test.ts`)

- Tipo de entrada `SetConSerie = { exercise_id: string; fecha: string; serie: number; reps_hechas: number | null; peso_usado: number | null }`.
- `UltimaSesion = { fecha: string; peso: number | null; reps: (number | null)[] }` — `peso` = máx `peso_usado` del día; `reps[i]` = reps de la serie i+1 (huecos → null).
- `ultimaSesionPorEjercicio(rows: SetConSerie[]): Map<string, UltimaSesion>` — para cada ejercicio, su fecha más reciente y las series de ese día.
- `resumenUltimaSesion(s: UltimaSesion): string` — `"12·12·8·8 × 20 kg"`; sin peso → `"12·12·8·8"`; sin reps (todas null) → `"20 kg"`; los null intermedios se muestran como `–`.

### `src/lib/coach.ts` (editar; los 5 tests actuales deben seguir verdes)

- **`analizarProgresion(sesiones: SesionPeso[], paso = 2.5): { tipo: 'subir' | 'bajar'; peso: number; sesiones: number } | null`** — versión estructurada de la regla actual: `subir` → `peso = actual + paso`, `sesiones = 2`; `bajar` → `peso = actual - paso`, `sesiones = nº estancadas`. `sugerenciaProgresion` se reimplementa llamándola (mismos textos exactos).
- **`sesionesDesdeLogs(rows: SetConSerie[], objetivoSeries: number, objetivoReps: number): SesionPeso[]`** — agrupa por fecha (más reciente primero): `peso` = máx del día; `repsOk` = (nº series registradas ≥ `objetivoSeries`) **y** (todas las `reps_hechas` no nulas y ≥ `objetivoReps`). Con tests.

### `src/pages/WorkoutPage.tsx` (editar)

- El `select` de `set_logs` añade `serie`. Del mismo resultado se construye, además de lo existente, un `Map<exercise_id, SetConSerie[]>` en estado (`logsPorEjercicio`).
- Por render del ejercicio actual (useMemo sobre `item` + `logsPorEjercicio`):
  - `ultima = ultimaSesionPorEjercicio(...).get(item.exercise_id)` (o precomputado en el mismo Map).
  - `reco = analizarProgresion(sesionesDesdeLogs(rows, item.series, parseInt(item.reps, 10) || 0))`.
- **Defaults** (cadena en `value`, en `repsDeSerie` y en el peso efectivo de `marcarSerie`/`volumenSesion`/`guardarPeso`):
  - Peso: `pesos[item.id] ?? ultima?.peso ?? item.peso` (como valor del input, editable).
  - Reps serie s: `repsPorSerie[item.id]?.[s] ?? ultima?.reps[s] ?? objetivo`.
- **Línea "Última vez"**: sobre el bloque "Peso de hoy", `Última vez: {resumenUltimaSesion(ultima)}` en texto pequeño (zinc-500), fija; solo si `ultima` existe.
- **Chip del coach**: bajo la línea "Última vez", si `reco` existe y el peso efectivo actual ≠ `reco.peso`:
  - `subir`: chip lima — "⚡ Sube a {peso} kg · 2 sesiones cumpliendo" + botón "Aplicar".
  - `bajar`: chip ámbar — "↓ Baja a {peso} kg · {n} sesiones sin cerrar las reps" + botón "Aplicar".
  - "Aplicar": `setPesos` con el sugerido + `guardarPeso(item)` (persiste el plan). Al coincidir el peso efectivo con el sugerido, el chip deja de renderizarse.
- **Colores por serie**: en el input de reps, cuando `hecha && ultima?.reps[s] != null`: reps hechas > última → borde/texto verde (accent); < última → ámbar (`border-amber-500/60 text-amber-400`); igual → estilo actual de marcado. Sin referencia → estilo actual.

### `src/pages/DashboardPage.tsx` (editar)

- Nueva query ligera al montar: `routine_day_exercises` (`exercise_id, series, reps`) → `Map<exercise_id, { series, reps }>` (si un ejercicio aparece en varios días, se queda la entrada de más `series`).
- El memo `coach` deja el `repsOk: true` fijo y pasa a construir las sesiones con `sesionesDesdeLogs(rowsDelEjercicio, series, parseInt(reps))` (reps reales).
- `generarIA`: añade al `resumen` la clave `progresion_ejercicios`: hasta 8 ejercicios con actividad reciente, cada uno `{ nombre, ultimas_sesiones: [hasta 3 strings "12·11·8·8 × 20 kg (2026-07-13)"], sugerencia_regla: "subir a 22.5 kg" | "bajar a 17.5 kg" | null }`. Sin cambios en la Edge Function.

## Casos borde

- Sin sesión previa → sin línea, sin chip, defaults = objetivo del plan (comportamiento actual).
- Última sesión con menos series que el plan → las series sin referencia caen al objetivo y no se colorean.
- Última sesión sin peso registrado → la línea muestra solo reps; el peso cae a `item.peso`.
- `reps` del plan tipo "12+12" → objetivo = primer número (convención existente).
- El chip no aparece si el peso efectivo ya es el sugerido (incluye recién aplicado).

## Pruebas

- `lastSession.test.ts`: última fecha por ejercicio; peso máx del día; reps por serie con huecos; `resumenUltimaSesion` (completo, sin peso, sin reps, null intermedio).
- `coach.test.ts` (ampliar): `analizarProgresion` (subir/bajar/null estructurados); `sesionesDesdeLogs` (agrupación, orden, `repsOk` con series insuficientes / reps bajas / null). Los 5 tests actuales de `sugerenciaProgresion` sin cambios.
- Navegador (cuenta +prueba, sembrando con script Node y limpiando): 1 sesión previa 12·12·8·8×20 → inputs rellenados + línea "Última vez"; 2 sesiones cumpliendo 4×12 a 20 → chip "Sube a 22,5" + Aplicar rellena el peso; marcar una serie con reps > última → verde, < última → ámbar. En Progreso, el análisis IA se puede regenerar y el resumen incluye `progresion_ejercicios` (verificable por red).
- `npm run build` + los 87 tests actuales verdes.

## Fuera de alcance

- Botón "Preguntar al coach IA" dentro del entrenamiento (latencia y coste por consulta; la IA queda en Progreso).
- Cambiar el paso de 2,5 kg por ejercicio (configuración fina).
- Historial de más de una sesión en la vista del ejercicio (para eso está la gráfica de la ficha).

## Notas de implementación

- Sin migración.
- Encoding: solo tools Edit/Write. Verificación: `read_page`/`javascript_exec` (capturas dan timeout); sembrar vía script Node local; si la sesión del navegador caducó (login), pedir al usuario que reloguee — no iniciar sesión con contraseñas.
- La Edge Function no se toca: el `resumen` viaja como JSON y la función lo incrusta tal cual.
