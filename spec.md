# Prompt para Claude Code v5 — App personal de hábitos (entrenamiento, hidratación, dieta y sueño)

Sustituye a las versiones anteriores.

**Cómo usarlo (recomendado):** guarda este archivo como `spec.md` en la carpeta raíz de tu proyecto y en Claude Code escribe: `Lee @spec.md y ejecútalo empezando por la Fase 1`. Así no hay que pegar nada. Si prefieres pegarlo, copia desde el archivo descargado (texto en crudo), nunca desde la vista renderizada del chat.

---

Quiero que construyas una aplicación web premium de seguimiento y gamificación de mis hábitos diarios: **entrenamiento, hidratación, dieta y sueño**. Es una app de **uso personal, no comercial**: la usaré yo y como mucho 2-3 amigos. Prioriza velocidad de desarrollo, simplicidad de mantenimiento y coste cero (free tiers de Supabase y Netlify) sobre escalabilidad. Viene precargada con mi rutina real de gimnasio (al final, en "Datos iniciales").

Trabaja por fases: completa y verifica cada fase antes de pasar a la siguiente, y enséñame el resultado al final de cada una para que pueda dar feedback.

## Stack y arquitectura

- **Frontend:** React + Vite + TypeScript. Tailwind CSS para estilos.
- **Backend/BD/Auth/Storage:** Supabase (Postgres + Auth + Storage + Row Level Security).
- **Despliegue:** Netlify (SPA con redirects configurados en `netlify.toml`).
- **Auth:** solo email/contraseña vía Supabase Auth. Nada de OAuth (para 2-4 usuarios no compensa la configuración). Toda la app está detrás de login.
- Aunque seamos pocos y amigos, cada usuario solo ve sus propios datos: activa RLS en TODAS las tablas y en Storage desde el primer momento, con políticas `auth.uid() = user_id`.
- Migraciones SQL versionadas en `supabase/migrations/`. Variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, con `.env.example` y explicación final de qué rellenar.

## Modelo de datos (mínimo)

- `profiles` (id = auth.uid, nombre, objetivo — p. ej. "Hipertrofia" —, fecha de inicio, `water_goal_ml` default 2500, `sleep_goal_hours` default 7).
- `exercises` (id, user_id, nombre, grupo muscular, notas de técnica, `search_hint_en` — término de búsqueda sugerido en inglés —, `photo_url` nullable, `video_url` nullable — enlace de YouTube en crudo).
- `routine_days` (user_id, día de la semana, título — p. ej. "Espalda y gemelos").
- `routine_day_exercises` (routine_day_id, exercise_id, orden, series int, **reps como TEXTO** — hay esquemas tipo "12+12" —, peso/carga numérico editable, descanso en segundos, notas).
- `set_logs` (user_id, exercise_id, fecha, serie, reps hechas, peso usado) para el historial de progresión de cargas.
- `cardio_sessions` (user_id, día de la semana, duración min, momento — "post-entreno" / "ayunas" —, tipo, método, zona/velocidad, notas).
- `daily_log` (user_id, fecha, `exercise_done` bool, `diet_done` bool, `sleep_done` bool, `hydration_done` bool, `water_ml` int default 0, horas de sueño numérico opcional, notas). UNIQUE (user_id, fecha).
- La puntuación diaria (ver Gamificación) se calcula derivada de `daily_log`, no necesita tabla propia.

## Funcionalidades

### 1. Rutina de ejercicio editable
- Vista de rutina semanal: cada día muestra su título, sus ejercicios en orden (series × reps × peso × descanso) y su bloque de cardio si lo tiene.
- CRUD completo de ejercicios y de la asignación a días (crear, editar, reordenar con drag & drop, eliminar). El campo KGS de mi rutina viene vacío: debo poder rellenar y actualizar pesos fácilmente desde el móvil, con historial de progresión por ejercicio (`set_logs`).

### 2. Media de los ejercicios: vídeo de YouTube embebido y/o foto propia (NO hay generación automática de imágenes)
No generes ilustraciones ni descargues imágenes de ningún sitio: toda la media la añado yo manualmente. La app solo tiene que hacer trivial añadirla y mostrarla bien.

**Prioridad de visualización por ejercicio:** vídeo de YouTube si existe → foto propia si no hay vídeo → tarjeta placeholder tipográfica limpia (nombre + grupo muscular + series×reps) con CTA claro de "Añadir vídeo o foto". Si un ejercicio tiene ambos, el vídeo es lo principal y la foto queda accesible con un toggle pequeño (útil cuando no hay cobertura).

**Vídeo de YouTube (mecanismo preferente):**
- Campo para pegar el enlace desde el móvil (normalmente vendrá del botón compartir de la app de YouTube). El parsing debe ser robusto: acepta `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, con parámetros extra tipo `si=`, y **soporta marca de tiempo** (`t=90` o `t=1m30s` → el embed arranca en ese segundo con `start=`). Esto importa porque muchas demostraciones están dentro de vídeos largos. Implementa una utilidad `parseYouTubeUrl()` con tests unitarios.
- **Preview inmediata al pegar el enlace** en el formulario de edición: algunos canales tienen el embed deshabilitado y necesito verlo en el momento para elegir otro vídeo si no reproduce. Debajo del reproductor, siempre un enlace "Abrir en YouTube" como salida de emergencia.
- **Embed ligero (patrón facade), obligatorio:** NO cargues iframes de YouTube al renderizar la lista o el modo entrenamiento (cada iframe pesa más de 1 MB de JS y en el gimnasio la conexión es mala). Muestra solo la miniatura (`https://i.ytimg.com/vi/{id}/hqdefault.jpg`) con botón de play superpuesto; al tocar, sustituye por el iframe `https://www.youtube-nocookie.com/embed/{id}?start={s}&autoplay=1&rel=0&playsinline=1`. `playsinline` es imprescindible para que en iOS no fuerce pantalla completa. Nunca autoplay sin interacción.
- Botón "Buscar en YouTube" en la ficha de cada ejercicio sin vídeo: abre `youtube.com/results?search_query={search_hint_en}` en pestaña nueva para encontrar candidatos en un toque.

**Foto propia desde el gimnasio:**
- Botón de cámara en la ficha del ejercicio y en el modo entrenamiento: `<input type="file" accept="image/*" capture="environment">`, compresión en cliente antes de subir (redimensionar a máx. 1280 px el lado mayor, exportar a WebP calidad ~0.8; una foto de móvil de 6 MB debe quedar en 150-300 KB), subida a bucket de Supabase Storage `exercise-media` con path `user_id/exercise_id.webp` y política de escritura restringida a la carpeta del propio usuario.

**Biblioteca pendiente (mini-gamificación):** en la vista de rutina, un contador de progreso "X/38 ejercicios con demostración" con filtro para ver los que faltan, de modo que completar la biblioteca sea en sí un objetivo los primeros días.

### 3. Modo entrenamiento (motivación en el momento)
- Botón "Empezar entrenamiento de hoy": ejercicios del día uno a uno, con su media grande (vídeo facade o foto según prioridad), series/reps/peso objetivo, checkboxes por serie y registro rápido del peso usado.
- Temporizador de descanso que arranca al marcar una serie, precargado con el descanso de ese ejercicio (90'', 60'', 40''...), con aviso visual al terminar.
- Si el día tiene cardio (lunes post-entreno, sábado en ayunas), aparece como bloque final o único con su duración y tipo.
- Al completar el entrenamiento, marca automáticamente `exercise_done` y muestra pantalla de celebración (animación, resumen, racha, puntos del día).

### 4. Hidratación (contador activo, no checkbox)
- Objetivo diario configurable en perfil (default 2500 ml).
- Widget siempre accesible en la home: anillo/barra de progreso del día + botones rápidos "+250 ml" y "+500 ml" (cantidades configurables) usables con un toque desde el móvil.
- `hydration_done` se marca automáticamente al alcanzar el objetivo; corrección manual posible desde el panel del día.

### 5. Calendario de cumplimiento
- Vista mensual: cada día muestra CUATRO indicadores (ejercicio, dieta, sueño, hidratación) en estado cumplido / no cumplido / sin registrar.
- Click en un día abre un panel para marcar/desmarcar hábitos, ajustar agua, añadir horas de sueño y notas. `sleep_done` = horas ≥ objetivo (o marca manual).
- Lógica de descanso: domingo descanso total (ejercicio cuenta como "no aplica" o cumplido automático, configurable). Sábado solo cardio: cumplir el sábado = hacer el cardio.

### 6. Gráficas y progreso
- Dashboard con: racha actual y mejor racha por hábito, % de cumplimiento 7/30/90 días, heatmap tipo GitHub contributions con los cuatro hábitos, litros de agua y horas de sueño en línea temporal, y progresión de cargas por ejercicio (selector).
- Usa Recharts o similar. Gráficas legibles de un vistazo, sin ruido.

### 7. Gamificación y adherencia
- **Puntos diarios:** 1 punto por hábito cumplido (máx. 4) + 1 bonus por "día perfecto" (4/4) = máx. 5/día. Totales semanales y mensuales visibles. Este sistema debe quedar encapsulado en una función/servicio único para poder reutilizarlo en la fase social.
- **Rachas flexibles:** la racha no se rompe por un único día fallado si los 6 anteriores están cumplidos ("día de gracia", máx. 1 por semana). Muéstralo explícitamente para que un fallo puntual no desmotive.
- Mensajes de refuerzo contextuales basados en datos reales ("3 semanas seguidas cumpliendo sueño"), no frases genéricas.
- Si ayer quedó sin registrar, banner discreto para completarlo.
- Hitos: badges por 7/30/100 días de cumplimiento por hábito y por días perfectos acumulados.

## Diseño (prioritario)

Acabado realmente premium, no plantilla genérica:
- Dark mode por defecto con opción light. Paleta sobria con un solo color de acento potente.
- Tipografía cuidada (display para números grandes de rachas/puntos, sans limpia para el resto). Las tarjetas placeholder de ejercicios sin media deben verse intencionadas y elegantes, no como algo roto.
- Microinteracciones: transiciones suaves, feedback satisfactorio al marcar hábitos y al llenar el anillo de hidratación, animación especial al lograr el día perfecto, skeleton loaders.
- Mobile-first: la usaré sobre todo desde el móvil en el gimnasio; modo entrenamiento y botón de agua usables con una mano.
- Nada de emojis decorativos por todas partes ni degradados morados genéricos de IA.

## Fases de trabajo

1. **Fase 1:** scaffolding, Supabase (migraciones + RLS + bucket de Storage), auth email/contraseña, layout base y navegación.
2. **Fase 2:** rutina editable precargada con los datos iniciales + gestión de media (parser y embed de YouTube, subida de fotos con compresión, biblioteca pendiente) + modo entrenamiento.
3. **Fase 3:** registro diario: calendario de 4 hábitos + contador de hidratación + registro de sueño.
4. **Fase 4:** dashboard, gráficas, puntos, rachas y badges.
5. **Fase 5:** pulido de diseño, estados vacíos, responsive, config de Netlify y guía de despliegue paso a paso (crear proyecto Supabase, aplicar migraciones, variables en Netlify).
6. **Fase 6 (OPCIONAL — no la empieces sin mi confirmación explícita):** modo amigos. Grupos con código de invitación, leaderboard semanal de puntos y rachas entre miembros. Solo se comparte el cumplimiento agregado (puntos, rachas, días perfectos); nunca notas, comidas ni detalles. Requiere tabla `group_members` y políticas RLS específicas de lectura entre miembros.

Antes de escribir código, muéstrame el plan de la Fase 1 y el esquema SQL propuesto para que lo valide.

## Datos iniciales (mi rutina real — objetivo: Hipertrofia, mes: Febrero)

El bloque JSON de abajo es el contenido LITERAL de `src/data/rutina-inicial.json`: guárdalo tal cual, sin reinterpretar datos ni renombrar claves. Está normalizado igual que el esquema: un catálogo `ejercicios` con id único y una `rutina` que los referencia por id con sus parámetros por día. No de-dupliques por nombre: existen dos "Press mancuernas" distintos (hombro y pecho) con ids diferentes a propósito; en la UI, cuando un nombre pueda repetirse, muestra el grupo muscular junto al nombre.

Crea un botón de onboarding "Importar rutina de ejemplo" que inserte estos datos vía cliente Supabase para el usuario logueado (compatible con RLS); cualquier usuario nuevo puede importarla o empezar en blanco. Todos los ejercicios arrancan sin media (`photo_url` y `video_url` a null): la iré añadiendo yo. `search_hint_en` es solo el término que ofrecerá el botón "Buscar en YouTube"; en los nombres de argot es mi mejor interpretación, y el vídeo o foto que yo elija es lo que manda. La carga (KGS) viene vacía a propósito: la rellenaré en la app.

```json
{
  "objetivo": "Hipertrofia",
  "mes": "Febrero",
  "ejercicios": {
    "jalones_pala": { "nombre": "Jalones pala", "grupo": "Espalda", "search_hint_en": "lat pulldown MAG grip" },
    "jalones_convergente": { "nombre": "Jalones convergente", "grupo": "Espalda", "search_hint_en": "iso-lateral converging lat pulldown machine" },
    "jalones_cerrado": { "nombre": "Jalones cerrado", "grupo": "Espalda", "search_hint_en": "close grip lat pulldown" },
    "remo_tiro_bajo_1_mano": { "nombre": "Remo tiro bajo 1 mano", "grupo": "Espalda", "search_hint_en": "single arm seated cable row" },
    "remo_prono_multi": { "nombre": "Remo prono multi", "grupo": "Espalda", "search_hint_en": "smith machine bent over row pronated" },
    "lumbares_banco_90": { "nombre": "Lumbares banco 90°", "grupo": "Espalda", "search_hint_en": "back extension 90 degree bench" },
    "gemelos_burro": { "nombre": "Gemelos burro", "grupo": "Gemelos", "search_hint_en": "donkey calf raise" },
    "gemelos_sentado": { "nombre": "Gemelos sentado", "grupo": "Gemelos", "search_hint_en": "seated calf raise" },
    "crunch_90": { "nombre": "Crunch 90°", "grupo": "Abdomen", "search_hint_en": "crunch legs 90 degrees" },
    "crunch_declinado_peso": { "nombre": "Crunch declinado con peso ligero", "grupo": "Abdomen", "search_hint_en": "decline weighted crunch" },
    "elevacion_piernas_silla_romana": { "nombre": "Elevación de piernas en silla romana", "grupo": "Abdomen", "search_hint_en": "captain's chair leg raise" },
    "press_multipower_hombro": { "nombre": "Press multipower", "grupo": "Hombro", "search_hint_en": "smith machine shoulder press" },
    "press_mancuernas_hombro": { "nombre": "Press mancuernas (hombro)", "grupo": "Hombro", "search_hint_en": "seated dumbbell shoulder press" },
    "elevacion_lateral_convergente": { "nombre": "Elevación lateral convergente", "grupo": "Hombro", "search_hint_en": "machine lateral raise" },
    "frontales_disco_tumbado_30": { "nombre": "Frontales disco tumbado 30°", "grupo": "Hombro", "search_hint_en": "incline plate front raise" },
    "posteriores_neutro_prono_placas": { "nombre": "Posteriores neutro + prono placas", "grupo": "Hombro", "search_hint_en": "plate loaded rear delt fly" },
    "trapecio_carro": { "nombre": "Trapecio carro", "grupo": "Hombro", "search_hint_en": "machine shrug" },
    "sentadilla_convergente": { "nombre": "Sentadilla convergente", "grupo": "Piernas", "search_hint_en": "V squat machine" },
    "pendulo": { "nombre": "Péndulo", "grupo": "Piernas", "search_hint_en": "pendulum squat" },
    "prensa_horizontal": { "nombre": "Prensa horizontal", "grupo": "Piernas", "search_hint_en": "horizontal leg press" },
    "zancadas": { "nombre": "Zancadas", "grupo": "Piernas", "search_hint_en": "walking lunges", "nota": "El 20 se registra tal cual; editable si resulta ser por pierna." },
    "curl_cuadriceps": { "nombre": "Curl cuádriceps", "grupo": "Piernas", "search_hint_en": "leg extension", "nota": "Interpretado como extensión de cuádriceps en máquina; el vídeo que enlace el usuario es lo que vale." },
    "femoral_tumbado": { "nombre": "Femoral tumbado", "grupo": "Piernas", "search_hint_en": "lying leg curl" },
    "curl_1_pierna_femoral": { "nombre": "Curl 1 pierna femoral", "grupo": "Piernas", "search_hint_en": "single leg curl" },
    "simultaneo_sentado_rotacion": { "nombre": "Simultáneo sentado rotación", "grupo": "Bíceps", "search_hint_en": "seated dumbbell curl with rotation" },
    "scott": { "nombre": "Scott", "grupo": "Bíceps", "search_hint_en": "preacher curl" },
    "barra_z": { "nombre": "Barra Z", "grupo": "Bíceps", "search_hint_en": "EZ bar curl" },
    "jesucristo": { "nombre": "Jesucristo", "grupo": "Bíceps", "search_hint_en": "overhead cable curl crucifix" },
    "jalones_recto": { "nombre": "Jalones recto", "grupo": "Tríceps", "search_hint_en": "straight bar triceps pushdown" },
    "impulsion": { "nombre": "Impulsión", "grupo": "Tríceps", "search_hint_en": "triceps dips", "nota": "Nombre ambiguo (¿fondos/dips o patada de tríceps?); se resolverá con el vídeo o foto que añada el usuario." },
    "anilla_supino": { "nombre": "Anilla supino", "grupo": "Tríceps", "search_hint_en": "single handle supinated pushdown" },
    "soga_tras_nuca": { "nombre": "Soga tras nuca", "grupo": "Tríceps", "search_hint_en": "overhead rope triceps extension" },
    "press_mancuernas_pecho": { "nombre": "Press mancuernas (pecho)", "grupo": "Pecho", "search_hint_en": "flat dumbbell bench press" },
    "press_convergente_pecho": { "nombre": "Press convergente", "grupo": "Pecho", "search_hint_en": "converging chest press machine" },
    "aperturas_planas": { "nombre": "Aperturas planas", "grupo": "Pecho", "search_hint_en": "flat dumbbell fly" },
    "inclinado_multi": { "nombre": "Inclinado multi", "grupo": "Pecho", "search_hint_en": "smith machine incline press" },
    "aperturas_inclinadas": { "nombre": "Aperturas inclinadas", "grupo": "Pecho", "search_hint_en": "incline dumbbell fly" },
    "press_declinado": { "nombre": "Press declinado", "grupo": "Pecho", "search_hint_en": "decline press" }
  },
  "rutina": [
    {
      "dia": "lunes",
      "titulo": "Espalda y gemelos",
      "items": [
        { "ejercicio": "jalones_pala", "orden": 1, "series": 4, "reps": "12", "descanso_seg": 90 },
        { "ejercicio": "jalones_convergente", "orden": 2, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "jalones_cerrado", "orden": 3, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "remo_tiro_bajo_1_mano", "orden": 4, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "remo_prono_multi", "orden": 5, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "lumbares_banco_90", "orden": 6, "series": 3, "reps": "25", "descanso_seg": 10 },
        { "ejercicio": "gemelos_burro", "orden": 7, "series": 5, "reps": "20", "descanso_seg": 20 },
        { "ejercicio": "gemelos_sentado", "orden": 8, "series": 5, "reps": "20", "descanso_seg": 20 }
      ]
    },
    {
      "dia": "martes",
      "titulo": "Abdomen y hombro",
      "items": [
        { "ejercicio": "crunch_90", "orden": 1, "series": 4, "reps": "25", "descanso_seg": 30 },
        { "ejercicio": "crunch_declinado_peso", "orden": 2, "series": 4, "reps": "15", "descanso_seg": 30 },
        { "ejercicio": "elevacion_piernas_silla_romana", "orden": 3, "series": 3, "reps": "25", "descanso_seg": 30 },
        { "ejercicio": "press_multipower_hombro", "orden": 4, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "press_mancuernas_hombro", "orden": 5, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "elevacion_lateral_convergente", "orden": 6, "series": 4, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "frontales_disco_tumbado_30", "orden": 7, "series": 4, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "posteriores_neutro_prono_placas", "orden": 8, "series": 4, "reps": "12+12", "descanso_seg": 40 },
        { "ejercicio": "trapecio_carro", "orden": 9, "series": 4, "reps": "12", "descanso_seg": 40 }
      ]
    },
    {
      "dia": "miercoles",
      "titulo": "Piernas",
      "items": [
        { "ejercicio": "sentadilla_convergente", "orden": 1, "series": 4, "reps": "12", "descanso_seg": 90 },
        { "ejercicio": "pendulo", "orden": 2, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "prensa_horizontal", "orden": 3, "series": 4, "reps": "15", "descanso_seg": 60 },
        { "ejercicio": "zancadas", "orden": 4, "series": 4, "reps": "20", "descanso_seg": 60 },
        { "ejercicio": "curl_cuadriceps", "orden": 5, "series": 4, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "femoral_tumbado", "orden": 6, "series": 4, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "curl_1_pierna_femoral", "orden": 7, "series": 4, "reps": "15", "descanso_seg": 40 }
      ]
    },
    {
      "dia": "jueves",
      "titulo": "Bíceps y tríceps",
      "items": [
        { "ejercicio": "simultaneo_sentado_rotacion", "orden": 1, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "scott", "orden": 2, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "barra_z", "orden": 3, "series": 4, "reps": "12", "descanso_seg": 60 },
        { "ejercicio": "jesucristo", "orden": 4, "series": 3, "reps": "20", "descanso_seg": 20 },
        { "ejercicio": "jalones_recto", "orden": 5, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "impulsion", "orden": 6, "series": 4, "reps": "10", "descanso_seg": 60 },
        { "ejercicio": "anilla_supino", "orden": 7, "series": 4, "reps": "15", "descanso_seg": 40 },
        { "ejercicio": "soga_tras_nuca", "orden": 8, "series": 3, "reps": "20", "descanso_seg": 20 }
      ]
    },
    {
      "dia": "viernes",
      "titulo": "Abdomen y pecho",
      "items": [
        { "ejercicio": "crunch_90", "orden": 1, "series": 4, "reps": "25", "descanso_seg": 30 },
        { "ejercicio": "crunch_declinado_peso", "orden": 2, "series": 4, "reps": "15", "descanso_seg": 30 },
        { "ejercicio": "elevacion_piernas_silla_romana", "orden": 3, "series": 3, "reps": "25", "descanso_seg": 30 },
        { "ejercicio": "press_mancuernas_pecho", "orden": 4, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "press_convergente_pecho", "orden": 5, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "aperturas_planas", "orden": 6, "series": 3, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "inclinado_multi", "orden": 7, "series": 4, "reps": "10", "descanso_seg": 90 },
        { "ejercicio": "aperturas_inclinadas", "orden": 8, "series": 3, "reps": "12", "descanso_seg": 40 },
        { "ejercicio": "press_declinado", "orden": 9, "series": 4, "reps": "10", "descanso_seg": 90 }
      ]
    }
  ],
  "cardio": [
    { "dia": "lunes", "duracion_min": 40, "momento": "post-entreno", "tipo": "elíptica", "metodo": "PROG 3", "zona_velocidad": "Zona 1" },
    { "dia": "sabado", "duracion_min": 50, "momento": "ayunas", "tipo": "caminar", "metodo": "continuo", "zona_velocidad": "Velocidad 6" }
  ],
  "descanso_total": ["domingo"]
}
```
