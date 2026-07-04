import { EmptyState } from '../components/EmptyState'

export function DashboardPage() {
  return (
    <EmptyState
      fase="Fase 4"
      titulo="Progreso y rachas"
      descripcion="Rachas por hábito, % de cumplimiento a 7/30/90 días, heatmap anual, evolución de agua y sueño, progresión de cargas por ejercicio, puntos y badges."
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
        </svg>
      }
    />
  )
}
