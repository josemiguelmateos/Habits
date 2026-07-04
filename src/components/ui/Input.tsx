import { useId, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-400">
        {label}
      </label>
      <input
        id={id}
        className={`min-h-11 rounded-xl border bg-ink-soft px-4 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent ${
          error ? 'border-red-500' : 'border-ink-border'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
