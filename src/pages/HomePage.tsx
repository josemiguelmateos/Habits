import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import { isoWeekday } from '../lib/days'
import { EmptyState } from '../components/EmptyState'

export function HomePage() {
  const { user } = useAuth()
  const rutina = useRoutine()
  const nombre = (user?.user_metadata?.nombre as string | undefined)?.split(' ')[0]
  const hoy = isoWeekday()

  const dayHoy = rutina.days.find((d) => d.weekday === hoy) ?? null
  const cardioHoy = rutina.cardio.filter((c) => c.weekday === hoy)
  const itemsHoy = dayHoy ? (rutina.itemsByDay.get(dayHoy.id) ?? []) : []
  const tieneRutina = rutina.days.length > 0 || rutina.exercises.length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-fade-up">
        <p className="text-sm text-zinc-500">
          {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
          {nombre ? `Hola, ${nombre}.` : 'Hola.'}
        </h2>
      </div>

      {/* Entrenamiento de hoy */}
      {!rutina.loading &&
        (dayHoy || cardioHoy.length > 0 ? (
          <Link
            to="/entrenar"
            className="card group flex animate-fade-up items-center justify-between px-5 py-4 transition-colors hover:border-accent/50"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Hoy toca
              </p>
              <p className="mt-1 font-display text-xl font-bold">
                {dayHoy?.titulo ?? 'Cardio'}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {[
                  itemsHoy.length > 0 ? `${itemsHoy.length} ejercicios` : null,
                  ...cardioHoy.map((c) => `cardio ${c.duracion_min ?? '—'} min`),
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-transform group-active:scale-95">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </Link>
        ) : tieneRutina ? (
          <div className="card animate-fade-up px-5 py-4">
            <p className="font-display text-lg font-semibold">
              {hoy === 7 ? 'Descanso total' : 'Hoy no hay entrenamiento'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {hoy === 7
                ? 'La recuperación también cuenta. Nos vemos el lunes.'
                : 'Puedes asignar algo a este día desde la rutina.'}
            </p>
          </div>
        ) : (
          <Link
            to="/rutina"
            className="card flex animate-fade-up items-center justify-between px-5 py-4 transition-colors hover:border-accent/50"
          >
            <div>
              <p className="font-display text-lg font-semibold">Importa tu rutina</p>
              <p className="mt-1 text-sm text-zinc-500">
                5 días de pesas + cardio, lista en un toque.
              </p>
            </div>
            <span className="text-accent">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ))}

      <EmptyState
        fase="Fase 3"
        titulo="Tu día, de un vistazo"
        descripcion="Aquí vivirán el anillo de hidratación con botones +250/+500 ml, los cuatro hábitos del día y el registro de sueño."
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
            <path d="M12 3a9 9 0 0 1 9 9" />
          </svg>
        }
      />
    </div>
  )
}
