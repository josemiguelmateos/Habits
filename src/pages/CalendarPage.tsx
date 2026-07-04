import { EmptyState } from '../components/EmptyState'

export function CalendarPage() {
  return (
    <EmptyState
      fase="Fase 3"
      titulo="Calendario de cumplimiento"
      descripcion="Vista mensual con los cuatro indicadores por día (ejercicio, dieta, sueño e hidratación) y panel para registrar cada jornada."
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M3.5 10h17M8 2.5V6M16 2.5V6" />
        </svg>
      }
    />
  )
}
