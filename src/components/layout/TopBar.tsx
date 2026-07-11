import { useLocation } from 'react-router-dom'

const titulos: Record<string, string> = {
  '/': 'Hoy',
  '/rutina': 'Rutina',
  '/dieta': 'Dieta',
  '/calendario': 'Calendario',
  '/progreso': 'Progreso',
  '/perfil': 'Perfil',
}

export function TopBar() {
  const { pathname } = useLocation()
  const titulo = titulos[pathname] ?? 'Habits'

  return (
    <header className="sticky top-0 z-10 border-b border-ink-border/60 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <h1 className="font-display text-lg font-semibold tracking-tight">{titulo}</h1>
        <span className="font-display text-xs font-medium uppercase tracking-widest text-accent">
          Habits
        </span>
      </div>
    </header>
  )
}
