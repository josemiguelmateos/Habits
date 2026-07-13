-- 0006: rotación semanal de opciones en la dieta.
-- semana NULL = comida fija (aparece todas las semanas del ciclo);
-- semana = 1..N = comida que solo aparece en esa semana del ciclo.
-- Las dietas ya importadas quedan todas NULL => 1 semana efectiva (sin cambios).
alter table diet_meals add column if not exists semana smallint;
