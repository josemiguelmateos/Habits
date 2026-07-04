import { EmptyState } from '../components/EmptyState'

export function RoutinePage() {
  return (
    <EmptyState
      fase="Fase 2"
      titulo="Tu rutina semanal"
      descripcion="Aquí verás tus días de entrenamiento con ejercicios, series × reps × peso, cardio, vídeos y fotos de cada ejercicio, y el modo entrenamiento. Incluirá el botón para importar tu rutina de Febrero."
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
        </svg>
      }
    />
  )
}
