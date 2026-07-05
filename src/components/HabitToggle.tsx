interface Props {
  label: string
  active: boolean
  disabled?: boolean
  onToggle: () => void
}

/** Toggle de hábito compartido entre la home y el panel del día. */
export function HabitToggle({ label, active, disabled, onToggle }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onToggle}
      className={`flex min-h-12 items-center justify-between rounded-xl border px-4 transition-all active:scale-[0.98] disabled:opacity-50 ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-ink-border bg-ink-card text-zinc-300'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
          active ? 'border-accent bg-accent text-accent-ink' : 'border-zinc-600'
        }`}
      >
        {active && (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  )
}
