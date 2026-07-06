// Edge Function "ai-coach": recibe un resumen agregado de los datos del
// usuario y devuelve un análisis de coach escrito por Claude.
// La clave ANTHROPIC_API_KEY vive como secreto de la función: nunca
// llega al navegador. El JWT de Supabase se verifica automáticamente
// (verify_jwt activado por defecto), así que solo usuarios logueados
// pueden invocarla.
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Eres el coach de Habits, una app personal de hábitos de gimnasio (entrenamiento, dieta, sueño e hidratación) de un usuario cuyo objetivo es la hipertrofia.

Recibes un JSON con sus datos reales: cumplimiento por hábito, rachas, medias de sueño y agua, volumen movido, récords y nivel.

Escribe un análisis semanal en español:
- 4 a 6 puntos, cada uno accionable y apoyado en los números concretos del JSON (nada de consejos genéricos que valdrían para cualquiera).
- Tono directo y motivador, de entrenador que se alegra del progreso pero no regala elogios.
- Sin emojis, sin saludos ni despedidas, sin repetir el JSON.
- Cierra con UN reto concreto y medible para la próxima semana.
- Si hay poco historial, dilo honestamente y centra el análisis en cómo construir el hábito de registrar.

Formato: puntos con guiones. Máximo ~180 palabras.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      { error: "Falta el secreto ANTHROPIC_API_KEY en la Edge Function." },
      500,
    );
  }

  let resumen: unknown;
  try {
    const body = await req.json();
    resumen = body?.resumen;
    if (!resumen || typeof resumen !== "object") {
      return json({ error: "Falta el campo 'resumen'." }, 400);
    }
  } catch {
    return json({ error: "Body JSON inválido." }, 400);
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Datos del usuario:\n${JSON.stringify(resumen)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "El modelo declinó la petición." }, 502);
    }

    const analisis = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return json({ analisis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `Error llamando a Claude: ${msg}` }, 502);
  }
});
