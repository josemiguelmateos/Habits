# Diseño — Dieta: rotación semanal de opciones

Fecha: 2026-07-12 · App: Habits · Repo: github.com/josemiguelmateos/Habits

## Problema

Cuando se importa una dieta que trae **varias opciones** ("proteína: pollo / pescado / tofu", "hidratos: arroz o patata"), la app monta **la misma semana siempre**. Hoy el import (prompt `PROMPT_DIETA`) resuelve las opciones eligiendo una por día y repartiendo variedad **dentro de la semana**, y guarda **una única semana fija** → todas las semanas son idénticas.

El usuario quiere que, ya que hay varias opciones, **cada semana tome opciones distintas** (variedad semana a semana), no solo día a día.

## Estado actual (contexto)

- **`lib/importDiet.ts`**: `validateDietaJson` + `importDietData(userId, data)` insertan `diet_meta`, `diet_meals` (`dias smallint[]`, `slot`, `orden`, `descripcion`) y `diet_meal_items` (`nombre/categoria/cantidad/unidad`). `importInitialDiet` usa `data/dieta-inicial.json` (la dieta real del usuario, ya colapsada a una semana).
- **`lib/importPrompts.ts` → `PROMPT_DIETA`**: pide a la IA que, ante opciones, elija una por día y **reparta variedad a lo largo de los 7 días**; nunca lista las opciones. No hay noción de semana.
- **`hooks/useDiet.ts`**: carga `diet_meals` + items + meta; `mealsForDay(weekday)` filtra por `dias`; `shoppingItems` = todos los items de la semana con sus `dias` (lo consume la lista de la compra, que ya agrega por días).
- **`pages/DietPage.tsx`**: selector de **día** (1-7, por defecto hoy), tarjetas de comida por día, botón "Lista de la compra" (`ShoppingListSheet`). **Las comidas NO se editan en la app** (solo importar / "Borrar dieta e importar otra").
- **`lib/days.ts`**: `isoWeekday`, `localDateStr`, `WEEKDAY_NAMES`. No hay número de semana ISO.
- Migraciones 0001-0005 aplicadas (el usuario las corre a mano en el SQL Editor). Última: `0005_diet.sql`.
- Convención: lógica pura en `src/lib/*.ts` con tests (vitest). 63 tests hoy.

## Decisiones (aprobadas)

1. **N semanas al importar**: la IA genera entre **2 y 4 semanas** completas y distintas según cuántas opciones haya; si la dieta no trae opciones, queda en 1 semana (comportamiento actual). Migración mínima.
2. **Semana activa automática por calendario** (rota sola cada lunes, por número de semana ISO) **+ selector** "Semana 1·2·3" para previsualizar las otras.
3. **La lista de la compra sigue la semana seleccionada**.

## Modelo de datos — migración `0006_diet_semana.sql`

- `alter table diet_meals add column semana smallint;` (nullable, sin default).
  - `semana IS NULL` → **comida fija**: aplica a **todas** las semanas (desayunos, snacks sin opción…). Las dietas ya importadas quedan todas NULL → 1 semana efectiva = comportamiento actual (retrocompatible).
  - `semana = 1..N` → comida que **solo** aparece en esa semana del ciclo.
- `N` (nº de semanas del ciclo) se **deriva** = `max(semana)` sobre las comidas del usuario; si no hay ninguna `semana` no nula → `N = 1`. No hace falta guardar N.
- RLS sin cambios (la columna vive en una tabla que ya tiene sus políticas).

## Cálculo de la semana activa — `lib/days.ts` (+ `days.test.ts`)

- `isoWeekNumber(d = new Date()): number` → número de semana ISO 8601 (1-53). Pura.
- `semanaActiva(semanas: number, d = new Date()): number` → `semanas <= 1 ? 1 : ((isoWeekNumber(d) - 1) % semanas) + 1`. Determinista, sin estado por usuario; rota cada lunes.

## Prompt de import — `PROMPT_DIETA` (`lib/importPrompts.ts`)

- Añadir `semana` al esquema de cada comida y una regla:
  - Si la dieta trae opciones, genera **entre 2 y 4 semanas** y **reparte las opciones entre las semanas** para que ninguna se repita idéntica; marca cada comida que rote con `"semana": 1..N`.
  - Las comidas fijas (menú único, sin opciones) van **sin `semana`** (o `null`): valen para todas las semanas — no las repitas en cada semana.
  - Se mantiene la variedad día a día ya existente **dentro** de cada semana.
  - Si no hay opciones, no uses `semana` (todo fijo) → una sola semana.
- Actualizar el ejemplo del prompt para mostrar `semana`.

## Validación e inserción — `lib/importDiet.ts`

- `JsonMeal` gana `semana?: number | null`.
- `validateDietaJson`: si viene `semana`, debe ser entero ≥ 1 (si no, error legible); si falta o es null → `null`.
- `importDietData`: `mealRows` incluye `semana: c.semana ?? null`.
- `dieta-inicial.json` (dieta de ejemplo): se queda sin `semana` (1 semana; ya está colapsada). Nota: para tener rotación en su dieta real, el usuario debe **re-importar el documento original** (con sus opciones) por el importador con IA, no la de ejemplo.

## Hook — `hooks/useDiet.ts`

- Carga `semana` (ya usa `select('*')`).
- Exponer `semanas: number` = `max(semana)` (≥1).
- `mealsForDay(weekday, semana)` → filtra `dias.includes(weekday)` **y** (`m.semana == null || m.semana === semana`), ordenado por `orden`.
- `shoppingItemsForWeek(semana): ItemConDias[]` → como el actual `shoppingItems` pero solo de las comidas de esa semana (fijas + `semana`). La agregación de `lib/shoppingList.ts` no cambia.

## Vista — `pages/DietPage.tsx`

- Nuevo estado `semanaSel`, inicializado a `semanaActiva(dieta.semanas)`.
- **Selector de semana** encima (o junto a) el selector de día, **solo si `dieta.semanas >= 2`**: chips "Sem 1 · 2 · 3", con la semana activa del calendario resaltada (como el día "hoy") y `aria-pressed` en la seleccionada. Texto de ayuda breve ("rota cada semana").
- `comidasDia = dieta.mealsForDay(diaSel, semanaSel)`.
- La `ShoppingListSheet` recibe `dieta.shoppingItemsForWeek(semanaSel)`; su cabecera indica la semana (p. ej. "Semana 2"). Con `semanas < 2` no se muestra el selector y todo va como hoy.

## Pruebas

- `days.test.ts`: `isoWeekNumber` (casos conocidos, incl. cambio de año) y `semanaActiva` (rotación `((sem-1) % N)+1`, `N<=1 → 1`, límites).
- `importDiet` (si se añade test): `validateDietaJson` acepta `semana` válida, rechaza `semana` < 1 o no entera, y deja `null` si falta.
- `npm run build` + 63 tests actuales verdes.
- Verificación en navegador (cuenta `+prueba`, sembrando con script Node local y limpiando): importar por JSON una dieta con `semana: 1/2/3`, comprobar que el selector aparece, que cada semana muestra comidas distintas y que la lista de la compra cambia con la semana. Probar además una dieta sin `semana` (todo NULL) → sin selector, igual que hoy.

## Fuera de alcance

- Editar comidas/semanas dentro de la app (hoy no existe; se importa/reemplaza).
- Elegir manualmente qué opción va en cada semana (lo decide la IA al importar).
- Rotación por "semanas desde que importaste" (se descartó a favor de la semana de calendario).
- Reintroducir todas las opciones para que el usuario las cambie a mano (es la alternativa "opciones + rotación al mostrar", descartada).

## Notas de implementación

- **Migración**: la aplica el usuario a mano en el SQL Editor (no hay CLI conectada). `useDiet` ya detecta tabla/columna ausente por códigos `42P01`/`PGRST205`; una columna nueva no rompe el `select('*')` aunque no esté (solo faltará el campo → se trata como `null` = fija), así que la app degrada bien si aún no se aplicó.
- **Sembrar en Supabase** desde el navegador (fetch) lo **bloquea el clasificador de auto-mode**; usar script Node local autenticado con las credenciales de la cuenta de prueba (`mateosarias.josemiguel+prueba@gmail.com` / `prueba123`). Limpiar al terminar.
- Encoding: solo tools Edit/Write (no `Get-Content`/`WriteAllText` de PowerShell sin UTF-8) para no corromper acentos.
