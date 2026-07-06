# Habits

App personal de seguimiento y gamificación de hábitos diarios: **entrenamiento, hidratación, dieta y sueño**. Pensada para uso propio y 2-3 amigos, con coste cero (free tiers de Supabase y Netlify).

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS (dark por defecto, acento lima)
- **Backend:** Supabase (Postgres + Auth + Storage, todo con Row Level Security)
- **Despliegue:** Netlify (SPA)

## Qué hace

- **Rutina semanal editable**: días con ejercicios (series × reps × peso × descanso) y cardio movible de día; reordenar con drag & drop; peso editable en dos toques.
- **Media por ejercicio**: vídeo de YouTube (pega el enlace del botón compartir, con soporte de marca de tiempo `t=1m30s`) con embed ligero que no carga el iframe hasta tocar, o foto propia hecha en el gimnasio (comprimida en el móvil antes de subir). Contador de biblioteca "X/38 con demostración".
- **Modo entrenamiento**: ejercicio a ejercicio, checkboxes por serie, registro de peso, temporizador de descanso con aviso, bloque de cardio y celebración final.
- **Registro diario**: anillo de hidratación con botones rápidos configurables (auto-cumplido al llegar al objetivo), sueño (auto-cumplido según tu meta), dieta y ejercicio. Calendario mensual con panel por día: hábitos + kg y notas por ejercicio y fecha.
- **Progreso**: rachas con día de gracia (un fallo no rompe la racha si los 6 días anteriores están cumplidos), % de cumplimiento 7/30/90, heatmap tipo GitHub, gráficas de agua/sueño/cargas y logros.

## Puesta en marcha desde cero

### 1. Supabase (base de datos y login) — 10 min

1. Crea una cuenta en [supabase.com](https://supabase.com) → **New project** (plan Free, región europea, guarda la contraseña de la BD).
2. Cuando termine de crearse, abre **SQL Editor** → **New query** y ejecuta, **en orden**, el contenido de cada archivo de `supabase/migrations/`:
   1. `0001_initial_schema.sql` (tablas + RLS + trigger de perfil)
   2. `0002_storage_bucket.sql` (bucket privado de fotos)
   3. `0003_exercise_day_logs.sql` (diario de kg/notas por ejercicio)
   4. `0004_friends.sql` (modo amigos: grupos, códigos de invitación y leaderboard)
3. **Authentication → Sign In / Providers → Email**: desactiva **Confirm email** (el email gratuito de Supabase tiene un límite muy bajo y para 2-4 usuarios no compensa).
4. **Project Settings → API**: copia la **Project URL** y la clave **anon / publishable**.

### 2. Desarrollo local

```bash
npm install
cp .env.example .env   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
npm test               # tests unitarios (parser de YouTube y rachas)
npm run build          # build de producción
```

Si faltan las variables, la app muestra una pantalla de configuración con estos mismos pasos.

### 3. Netlify (publicar) — 5 min

1. Sube el repo a GitHub.
2. En [netlify.com](https://netlify.com): **Add new site → Import an existing project → GitHub** → elige el repo. La configuración de build se detecta sola desde `netlify.toml`.
3. Antes de **Deploy**, añade las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Con cada `git push` a `main` se redespliega solo.
5. De vuelta en Supabase: **Authentication → URL Configuration → Site URL** = tu URL de Netlify.

> La clave *anon* no es un secreto: viaja en el navegador por diseño. Lo que protege los datos es el RLS: cada usuario solo ve lo suyo.

### 4. Coach IA (opcional) — Edge Function + clave de Anthropic

El botón "Análisis IA de tu semana" (pestaña Progreso) llama a una Edge Function
que envía un resumen agregado de tus datos a Claude. La clave API vive como
secreto en Supabase: nunca llega al navegador.

1. Crea una clave API en [console.anthropic.com](https://console.anthropic.com)
   (requiere método de pago; cada análisis cuesta ~1-2 céntimos con el modelo configurado, `claude-opus-4-8`).
2. En Supabase: **Edge Functions → Deploy a new function** → nombre `ai-coach` →
   pega el contenido de `supabase/functions/ai-coach/index.ts` → Deploy.
3. En **Edge Functions → ai-coach → Secrets** (o Project Settings → Edge Functions):
   añade `ANTHROPIC_API_KEY` con tu clave.

Si prefieres la CLI de Supabase: `supabase functions deploy ai-coach` y
`supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`.

Sin desplegar la función, la app funciona igual: el botón muestra un aviso y el
Coach de reglas (gratuito, en local) sigue haciendo sugerencias.

### 5. Modo amigos

Con la migración `0004` aplicada: en **Perfil → Amigos** crea un grupo y comparte
el código de 6 letras; tus amigos lo introducen en "Unirse con código". El
leaderboard semanal aparece en **Progreso** para todos los miembros. Solo se
comparte cumplimiento agregado (puntos, racha de ejercicio, días perfectos y
nivel) — nunca notas, comidas ni detalles.

### 6. Para cada amigo que se una

1. Abrir la URL de Netlify → **Crea tu cuenta**.
2. En **Rutina**, elegir: importar la rutina de ejemplo, **pegar la suya en JSON** (consejo: pásale una foto de tu tabla a ChatGPT/Claude y pídele el formato del ejemplo que muestra la app) o empezar en blanco.
3. En el móvil: menú del navegador → **Añadir a pantalla de inicio**.

## Estructura

```
supabase/migrations/   esquema SQL versionado (aplicar en orden)
src/
├─ lib/                parseYouTubeUrl, rachas, puntos, compresión de imagen… (con tests)
├─ hooks/              useRoutine, useProfile, useDailyLog, useAllLogs
├─ components/         layout, ui, rutina, calendario, entrenamiento, dashboard
└─ pages/              Hoy, Rutina, Entrenar, Calendario, Progreso, Perfil
```
