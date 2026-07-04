/**
 * Pantalla mostrada cuando faltan las variables de entorno de Supabase.
 * Evita un crash críptico y explica el siguiente paso.
 */
export function SetupPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-up">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Rutina — configuración
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
          Falta conectar Supabase
        </h1>
        <ol className="mt-6 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-zinc-400">
          <li>
            Crea un proyecto gratuito en{' '}
            <span className="text-zinc-200">supabase.com</span>.
          </li>
          <li>
            Ejecuta las migraciones de{' '}
            <code className="rounded bg-ink-raised px-1.5 py-0.5 text-accent">
              supabase/migrations/
            </code>{' '}
            en el SQL Editor (en orden: 0001 y 0002).
          </li>
          <li>
            Copia{' '}
            <code className="rounded bg-ink-raised px-1.5 py-0.5 text-accent">
              .env.example
            </code>{' '}
            a <code className="rounded bg-ink-raised px-1.5 py-0.5 text-accent">.env</code>{' '}
            y rellena <span className="text-zinc-200">VITE_SUPABASE_URL</span> y{' '}
            <span className="text-zinc-200">VITE_SUPABASE_ANON_KEY</span> (Project
            Settings → API).
          </li>
          <li>Reinicia el servidor de desarrollo.</li>
        </ol>
      </div>
    </div>
  )
}
