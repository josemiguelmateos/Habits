/**
 * Instrucciones que la app envía a la Edge Function para que Claude convierta
 * un documento (rutina/dieta) al esquema exacto de la app. Viven en el
 * frontend a propósito: así se pueden afinar sin redeplegar la función.
 */

export const PROMPT_RUTINA = `Eres un conversor. Recibes una rutina de gimnasio (texto extraído de un documento o un PDF adjunto) y devuelves ÚNICAMENTE un JSON válido con este esquema exacto, sin explicaciones ni markdown ni bloques de código:

{
  "ejercicios": {
    "clave_slug": { "nombre": "Nombre del ejercicio", "grupo": "Grupo muscular", "search_hint_en": "término de búsqueda en inglés" }
  },
  "rutina": [
    { "dia": "lunes", "titulo": "Título del día", "items": [
      { "ejercicio": "clave_slug", "orden": 1, "series": 4, "reps": "12", "descanso_seg": 90 }
    ] }
  ],
  "cardio": [
    { "dia": "sabado", "duracion_min": 40, "momento": "post-entreno", "tipo": "elíptica", "metodo": "continuo", "zona_velocidad": "Zona 1" }
  ]
}

Reglas:
- "ejercicios" es un diccionario: cada clave es un slug único en minúsculas con guiones bajos (p. ej. "press_banca"). Si dos ejercicios distintos comparten nombre, usa claves distintas.
- Cada item de "rutina" referencia un ejercicio por su clave. "reps" SIEMPRE es texto ("12", "10", "12+12", "al fallo"…). "series" y "descanso_seg" son números; si no hay descanso, usa 60. "orden" es la posición en el día (1,2,3…).
- "dia" debe ser uno de: lunes, martes, miercoles, jueves, viernes, sabado, domingo (en minúsculas y SIN tildes).
- "titulo" es el nombre del día (p. ej. "Espalda y gemelos"); si no hay, usa el grupo muscular principal.
- "search_hint_en" es tu mejor término de búsqueda de ese ejercicio en YouTube, en inglés.
- "cardio" es opcional: inclúyelo solo si el documento menciona cardio; si no, pon "cardio": [].
- Si la rutina ofrece ejercicios alternativos ("o", "/", "opción"), elige uno concreto por día.
- Extrae EXACTAMENTE lo que hay en el documento. No inventes ejercicios ni días que no aparezcan. Si la carga/KGS viene vacía, no la incluyas (se rellena en la app).`

export const PROMPT_DIETA = `Eres un conversor. Recibes una dieta semanal (texto extraído de un documento o un PDF adjunto) y devuelves ÚNICAMENTE un JSON válido con este esquema exacto, sin explicaciones ni markdown ni bloques de código:

{
  "objetivo": "p. ej. Volumen",
  "kcal": 2500,
  "notas": "notas generales si las hay",
  "comidas": [
    { "dias": [1], "slot": "Comida", "orden": 1, "semana": 1, "descripcion": "menú concreto de ese día",
      "items": [ { "nombre": "Arroz", "categoria": "Hidratos", "cantidad": 250, "unidad": "g" } ] }
  ]
}

Reglas del esquema:
- "dias": lista de días (1=lunes … 7=domingo) en los que se come esa comida.
- "slot": Desayuno, Media mañana, Comida, Snack, Merienda, Media tarde, Post-entreno, Cena…
- "orden": posición de la comida dentro del día (1 el desayuno, 2 la media mañana…).
- "descripcion": el menú concreto de esa comida (ver la regla de opciones).
- "items": desglosa cada ingrediente con su cantidad y unidad ("g","ml","ud","pieza","lata","rebanada","L"); si un ingrediente no lleva cantidad (p. ej. "verdura al gusto"), pon "cantidad": null y "unidad": null. Con esto se calcula la lista de la compra.
- "categoria" de cada item debe ser EXACTAMENTE una de: "Proteínas", "Hidratos", "Fruta y verdura", "Huevos y lácteos", "Otros".
- "semana" (opcional): número de semana del ciclo (1, 2, 3…) para las comidas que ROTAN entre semanas. Omítela (o null) en las comidas fijas que se repiten todas las semanas.

REGLA CLAVE — comidas con opciones o "escoge 1":
Muchas dietas no fijan un menú por día, sino que dan opciones a elegir ("Proteína (escoge 1): pollo / pescado / tofu…", "Carbohidratos: patata o arroz", listas separadas por "/" o "o"). En esos casos NO repitas todas las opciones en todos los días. Debes ELEGIR TÚ una opción concreta para cada día y REPARTIR las opciones a lo largo de la semana para dar variedad:
- Genera una comida distinta por día (usa "dias" de un solo día: [1], luego [2], … [7]) cuando el menú varíe entre días. Agrupa varios días en un mismo "dias" solo si comen exactamente lo mismo.
- No repitas la misma elección dos días seguidos; rota entre las opciones disponibles a lo largo de los 7 días para que la semana sea variada y equilibrada.
- La "descripcion" de cada día es SOLO la comida concreta elegida (p. ej. "175 g pechuga de pollo + 160 g patata + 10 ml AOVE + verduras"), NUNCA la lista de opciones.
- Los "items" son los ingredientes concretos de la elección de ese día, con cantidad y unidad. Si una opción da un rango (150-200 g), usa un valor representativo (p. ej. 175 g).
- Las comidas fijas (menú único, sin opciones) se mantienen tal cual, agrupando sus días en "dias".
- Las comidas marcadas como OPCIONAL ("solo si hay hambre") inclúyelas e indícalo en la descripción.

ROTACIÓN SEMANAL (además de la variedad diaria):
- Si hay opciones suficientes, genera entre 2 y 4 SEMANAS distintas y reparte las opciones entre ellas, de modo que cada semana use elecciones diferentes (no la misma dieta cada semana). Marca cada comida que rote con "semana": 1, 2, 3… según la semana del ciclo a la que pertenece.
- Las comidas fijas (menú único, sin opciones) van SIN "semana" (valen para todas las semanas): no las repitas en cada semana.
- Si la dieta no tiene opciones, no uses "semana" en ninguna comida (una sola semana).
- Mantén además la variedad día a día dentro de cada semana, como ya se indica arriba.

Extrae lo que hay en el documento; no inventes alimentos que no aparezcan. Si el documento trae su propia lista de la compra, IGNÓRALA: la app la recalcula sola desde los items. El objetivo final es que CADA día muestre un plan de comidas concreto y variado, nunca el mismo texto repetido en todos los días.`
