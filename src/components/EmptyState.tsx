import type { ReactNode } from 'react'

interface Props {
  fase: string
  titulo: string
  descripcion: string
  icon?: ReactNode
}

/** Placeholder elegante para páginas que se construyen en fases posteriores. */
export function EmptyState({ fase, titulo, descripcion, icon }: Props) {
  return (
    <div className="card flex animate-fade-up flex-col items-center gap-4 px-6 py-14 text-center">
      {icon && <div className="text-accent">{icon}</div>}
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {fase}
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-zinc-100">
          {titulo}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
          {descripcion}
        </p>
      </div>
    </div>
  )
}
