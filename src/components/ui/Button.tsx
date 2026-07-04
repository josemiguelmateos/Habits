import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const estilos: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink font-semibold hover:bg-accent-bright active:scale-[0.98] disabled:opacity-50',
  secondary:
    'bg-ink-raised text-zinc-100 border border-ink-border hover:border-zinc-500 active:scale-[0.98] disabled:opacity-50',
  ghost: 'text-zinc-400 hover:text-zinc-100 disabled:opacity-50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm transition-all duration-150 ${estilos[variant]} ${className}`}
      {...rest}
    />
  )
}
