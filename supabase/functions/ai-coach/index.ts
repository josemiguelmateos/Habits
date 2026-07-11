// Edge Function multiuso para Habits. Dos acciones, ambas con Claude:
//   1) Coach: recibe { resumen } → devuelve { analisis } (texto).
//   2) Importar: recibe { accion:"importar", tipo:"rutina"|"dieta",
//      formato:"texto"|"pdf", contenido? , pdf_base64? } → { json } con la
//      rutina/dieta ya estructurada en el esquema que la app importa.
// La clave ANTHROPIC_API_KEY vive como secreto de la función: nunca llega
// al navegador. El JWT de Supabase se verifica en el borde (solo logueados).
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-opus-4-8";

const SYSTEM_COACH = `Eres el coach de Habits, una app personal de hábitos de gimnasio (entrenamiento, dieta, sueño e hidratación) de un usuario cuyo objetivo es la hipertrofia.

Recibes un JSON con sus datos reales: cumplimiento por hábito, rachas, medias de sueño y agua, volumen movido, récords y nivel.

Escribe un análisis semanal en español:
- 4 a 6 puntos, cada uno accionable y apoyado en los números concretos del JSON (nada de consejos genéricos que valdrían para cualquiera).
- Tono directo y motivador, de entrenador que se alegra del progreso pero no regala elogios.
- Sin emojis, sin saludos ni despedidas, sin repetir el JSON.
- Cierra con UN reto concreto y medible para la próxima semana.
- Si hay poco historial, dilo honestamente y centra el análisis en cómo construir el hábito de registrar.

Formato: puntos con guiones. Máximo ~180 palabras.`;

const SCHEMA_RUTINA = `Eres un conversor. Recibes una rutina de gimnasio (texto extraído de un documento o un PDF adjunto) y devuelves ÚNICAMENTE un JSON válido con este esquema exacto, sin explicaciones ni markdown ni bloques de código:

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
- Extrae EXACTAMENTE lo que hay en el documento. No inventes ejercicios ni días que no aparezcan. Si la carga/KGS viene vacía, no la incluyas (se rellena en la app).`;

const SCHEMA_DIETA = `Eres un conversor. Recibes una dieta semanal (texto extraído de un documento o un PDF adjunto) y devuelves ÚNICAMENTE un JSON válido con este esquema exacto, sin explicaciones ni markdown ni bloques de código:

{
  "objetivo": "p. ej. Volumen",
  "kcal": 2500,
  "notas": "notas generales si las hay",
  "comidas": [
    { "dias": [1,2,3,4,5], "slot": "Comida", "orden": 1, "descripcion": "Texto de la comida tal cual",
      "items": [ { "nombre": "Arroz", "categoria": "Hidratos", "cantidad": 250, "unidad": "g" } ] }
  ]
}

Reglas CRÍTICAS:
- "dias" es la lista de días (1=lunes … 7=domingo) en los que se come esa comida. Una comida "fija todos los días" → [1,2,3,4,5,6,7]. Solo de lunes a viernes → [1,2,3,4,5]. Solo el lunes → [1].
- "slot" es el momento: Desayuno, Media mañana, Comida, Snack, Merienda, Media tarde, Post-entreno, Cena…
- "orden" ordena las comidas dentro del día (1 el desayuno, 2 la media mañana…).
- "descripcion" es el texto de la comida tal como aparece en el documento.
- "items" DEBE desglosar cada ingrediente con su cantidad y unidad, porque con eso se calcula la lista de la compra. Unidades típicas: "g", "ml", "ud", "pieza", "lata", "rebanada", "L". Si un ingrediente no lleva cantidad (p. ej. "verdura al gusto"), pon "cantidad": null y "unidad": null.
- "categoria" de cada item debe ser EXACTAMENTE una de: "Proteínas", "Hidratos", "Fruta y verdura", "Huevos y lácteos", "Otros".
- Extrae EXACTAMENTE lo que hay en el documento; no inventes comidas ni ingredientes. Si el documento trae su propia lista de la compra, IGNÓRALA: la app la recalcula sola desde los items.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extraerTexto(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n")
    .trim();
}

/** Quita ```json … ``` si el modelo lo envuelve, y parsea. */
function parseJsonLaxo(texto: string): unknown {
  let t = texto.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  return JSON.parse(t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "Falta el secreto ANTHROPIC_API_KEY en la Edge Function." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido." }, 400);
  }

  const client = new Anthropic({ apiKey });

  // ---- Acción: importar documento (rutina o dieta) ----
  if (body.accion === "importar") {
    const tipo = body.tipo;
    if (tipo !== "rutina" && tipo !== "dieta") {
      return json({ error: "tipo debe ser 'rutina' o 'dieta'." }, 400);
    }
    const system = tipo === "rutina" ? SCHEMA_RUTINA : SCHEMA_DIETA;

    let userContent: Anthropic.MessageParam["content"];
    if (body.formato === "pdf") {
      if (typeof body.pdf_base64 !== "string" || !body.pdf_base64) {
        return json({ error: "Falta pdf_base64." }, 400);
      }
      userContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: body.pdf_base64 },
        },
        { type: "text", text: `Convierte esta ${tipo} al JSON del esquema.` },
      ];
    } else {
      const contenido = typeof body.contenido === "string" ? body.contenido : "";
      if (!contenido.trim()) {
        return json({ error: "El documento está vacío o no se pudo leer." }, 400);
      }
      userContent = `Contenido del documento (${tipo}):\n\n${contenido}`;
    }

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: userContent }],
      });
      if (response.stop_reason === "refusal") {
        return json({ error: "El modelo declinó la petición." }, 502);
      }
      const texto = extraerTexto(response.content);
      let parsed: unknown;
      try {
        parsed = parseJsonLaxo(texto);
      } catch {
        return json(
          { error: "La IA no devolvió un JSON válido. Prueba con un documento más claro." },
          502,
        );
      }
      return json({ json: parsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: `Error llamando a Claude: ${msg}` }, 502);
    }
  }

  // ---- Acción por defecto: coach ----
  const resumen = body.resumen;
  if (!resumen || typeof resumen !== "object") {
    return json({ error: "Falta el campo 'resumen'." }, 400);
  }
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_COACH,
      messages: [
        { role: "user", content: `Datos del usuario:\n${JSON.stringify(resumen)}` },
      ],
    });
    if (response.stop_reason === "refusal") {
      return json({ error: "El modelo declinó la petición." }, 502);
    }
    return json({ analisis: extraerTexto(response.content) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `Error llamando a Claude: ${msg}` }, 502);
  }
});
