import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Item {
  to: string
  label: string
  icon: ReactNode
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const items: Item[] = [
  {
    to: '/',
    label: 'Hoy',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    ),
  },
  {
    to: '/rutina',
    label: 'Rutina',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
      </svg>
    ),
  },
  {
    to: '/calendario',
    label: 'Calendario',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 10h17M8 2.5V6M16 2.5V6" />
      </svg>
    ),
  },
  {
    to: '/progreso',
    label: 'Progreso',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
      </svg>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-border/60 bg-ink/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-w-16 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
