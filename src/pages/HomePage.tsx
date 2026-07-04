import { useAuth } from '../context/AuthContext'
import { EmptyState } from '../components/EmptyState'

export function HomePage() {
  const { user } = useAuth()
  const nombre = (user?.user_metadata?.nombre as string | undefined)?.split(' ')[0]

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

      <EmptyState
        fase="Fase 3"
        titulo="Tu día, de un vistazo"
        descripcion="Aquí vivirán el anillo de hidratación con botones +250/+500 ml, los cuatro hábitos del día y el acceso rápido al entrenamiento de hoy."
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
