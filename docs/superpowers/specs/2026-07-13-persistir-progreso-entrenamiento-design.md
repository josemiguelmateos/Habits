# Diseño — Persistir el progreso del entrenamiento + completado en la Home

Fecha: 2026-07-13 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

En mitad de un entrenamiento, si el usuario sale de `/entrenar` (o cierra/segunda-plano la app) y vuelve, **pierde el progreso**: las series marcadas, los kg y las reps por serie. Todo vive en estado de React y se descarta al desmontar `WorkoutPage`. Además, la tarjeta **"Hoy toca"** de la Home no muestra que el entrenamiento del día esté completado (siempre enseña el botón de play), aunque `daily_log.exercise_done` ya sea true.

## Estado actual (contexto)

- **`WorkoutPage.tsx`**: `hechas: Record<string, boolean[]>`, `pesos: Record<string, string>`, `repsPorSerie: Record<string, string[]>` — todo estado de React (se pierde al salir). `marcarSerie(it, serie, valor)`: al marcar (valor=true) inserta en `set_logs`; al **desmarcar (valor=false) NO borra** la fila insertada (inconsistencia). "Terminar" hace `daily_log.upsert({ exercise_done: true })` y muestra la `Celebration`.
- **`HomePage.tsx`**: la tarjeta "Hoy toca" (Link a `/entrenar`) muestra título + nº de ejercicios y un botón de play; **no refleja** `exercise_done`. El hábito "Ejercicio" (toggle pequeño) sí usa `dia.log?.exercise_done`.
- **`set_logs`** (migración 0001): una fila por `(user_id, exercise_id, fecha, serie, reps_hechas, peso_usado)`. Sin índice único.
- Convención: lógica pura en `src/lib/*.ts` con tests (vitest). 80 tests hoy.
- `signOut` (AuthContext) solo llama `supabase.auth.signOut()` → **no borra** otras claves de localStorage. Las únicas `localStorage.removeItem` del proyecto son de `BLANK_KEY` (rutina/dieta "en blanco").

## Decisiones (aprobadas)

1. **Persistencia = borrador local por usuario+día** en `localStorage` (no `set_logs`). Cubre el caso (mismo dispositivo) y guarda incluso kg/reps escritos antes de marcar. No sincroniza entre dispositivos (aceptado).
2. **Completado = al pulsar "Terminar"** (como ahora; mantiene la celebración). La Home lo refleja desde `exercise_done`.
3. **Al desmarcar una serie, borrar su fila de `set_logs`** para que el historial/gráficas no cuenten series retiradas.

## Arquitectura / archivos

### `src/lib/workoutDraft.ts` (nuevo, con `workoutDraft.test.ts`)

Lógica pura + envoltura fina de localStorage.

- Tipo `WorkoutDraft = { hechas: Record<string, boolean[]>; pesos: Record<string, string>; repsPorSerie: Record<string, string[]> }`.
- `draftKey(userId: string, fecha: string): string` → `` `habits:workout:${userId}:${fecha}` `` (puro, testeable).
- `parseDraft(raw: string | null): WorkoutDraft | null` → parseo **defensivo**: null si `raw` es null, JSON inválido, o no tiene la forma esperada (cada campo debe ser objeto); si falta un sub-campo, se rellena con `{}`. Nunca lanza. (puro, testeable).
- `loadDraft(userId, fecha): WorkoutDraft | null` → `parseDraft(localStorage.getItem(draftKey(...)))`.
- `saveDraft(userId, fecha, draft): void` → `localStorage.setItem(draftKey(...), JSON.stringify(draft))` (envuelto en try/catch; si falla el guardado, se ignora en silencio).
- `pruneOldDrafts(userId, fecha): void` → recorre `localStorage`, borra las claves con prefijo `habits:workout:${userId}:` cuya fecha ≠ `fecha` (evita acumular borradores de días pasados).

### `src/pages/WorkoutPage.tsx` (editar)

- **Restaurar al montar**: nuevo `useEffect` (deps `[user]`) que, con el `user` y `localDateStr()`, llama `pruneOldDrafts` y `loadDraft`; si hay borrador, `setHechas/setPesos/setRepsPorSerie` con sus valores. Un `useRef` `restaurado` evita pisar el borrador antes de cargarlo.
- **Guardar en cada cambio**: `useEffect` (deps `[user, hechas, pesos, repsPorSerie]`) que, una vez restaurado, hace `saveDraft(user.id, hoy, { hechas, pesos, repsPorSerie })`. (Escribe el estado completo; es pequeño.)
- **Desmarcar borra el set_log**: en `marcarSerie`, cuando `valor === false`, ejecutar `supabase.from('set_logs').delete().match({ user_id, exercise_id, fecha: hoy, serie: serie+1 })` (con `.then` por el builder lazy). El caso `valor === true` sigue insertando como ahora.
- No se toca la lógica de PR, volumen ni sparks.

### `src/pages/HomePage.tsx` (editar)

- La tarjeta "Hoy toca" pasa a reflejar `dia.log?.exercise_done`:
  - Si **completado**: en vez del círculo de play, un círculo con check (acento) y un texto/etiqueta "Completado" (p. ej. la línea de subtítulo muestra "Completado" en acento). Sigue siendo un `Link` a `/entrenar` (tocable para ver los ticks).
  - Si no: como ahora (play + nº de ejercicios).
- Solo cambia esa tarjeta; el resto de la Home queda igual.

## Flujo de datos

Marcar serie → `set_logs` insert (historial) + estado React → `saveDraft` (borrador). Desmarcar → `set_logs` delete + estado React → `saveDraft`. Salir/volver → `loadDraft` restaura los tres estados. Terminar → `daily_log.exercise_done = true` (el borrador **no** se borra, para que al re-entrar sigan los ticks). Día siguiente → `pruneOldDrafts` limpia el borrador viejo; clave nueva vacía.

## Pruebas

- `workoutDraft.test.ts`: `draftKey` (formato con userId+fecha); `parseDraft` (null con null/JSON inválido/forma incorrecta; rellena sub-campos que falten; round-trip de un draft válido). El acceso a `localStorage` (`loadDraft`/`saveDraft`/`pruneOldDrafts`) se cubre en navegador.
- Navegador (cuenta +prueba, lunes): marcar 2-3 series con kg/reps por serie → salir a la Home → volver a `/entrenar` → siguen los ticks/kg/reps. Desmarcar una serie → comprobar que su fila de `set_logs` desaparece. Pulsar "Terminar" → la tarjeta "Hoy toca" de la Home muestra "Completado"; re-entrar sigue mostrando los ticks. Limpiar datos de prueba al terminar.
- `npm run build` + los 80 tests actuales verdes.

## Fuera de alcance

- Sincronización del progreso entre dispositivos (sería vía `set_logs`; descartado).
- Actualizar filas de `set_logs` al editar kg/reps de una serie ya marcada (el valor se captura al marcar; editar después y querer que persista en el historial requeriría re-marcar). El borrador local sí conserva lo escrito para la UI.
- Auto-completar al marcar la última serie (se decidió mantener "Terminar" explícito).

## Notas de implementación

- Sin migración.
- Encoding: solo tools Edit/Write (no `Get-Content`/`WriteAllText` de PowerShell sin UTF-8).
- Verificación en navegador: capturas suelen dar timeout (~30s); usar `read_page`/`javascript_exec`. Sembrar/limpiar en Supabase vía script Node local (el fetch del navegador lo bloquea el clasificador).
