import { useMemo, useState } from 'react'
import { construirListaCompra, formatCantidad, type ItemConDias } from '../../lib/shoppingList'
import { Modal } from '../ui/Modal'

const CHECK_KEY = 'habits:compra-marcados'

function cargarMarcados(): Set<string> {
  try {
    const raw = localStorage.getItem(CHECK_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

interface Props {
  open: boolean
  items: ItemConDias[]
  semana?: number
  onClose: () => void
}

/** Lista de la compra: bruto total de la semana, agrupado y tachable. */
export function ShoppingListSheet({ open, items, semana, onClose }: Props) {
  const grupos = useMemo(() => construirListaCompra(items), [items])
  const [marcados, setMarcados] = useState<Set<string>>(cargarMarcados)

  const total = grupos.reduce((n, g) => n + g.lineas.length, 0)
  const hechos = grupos.reduce(
    (n, g) => n + g.lineas.filter((l) => marcados.has(keyOf(l.nombre, l.unidad))).length,
    0,
  )

  const toggle = (nombre: string, unidad: string | null) => {
    const k = keyOf(nombre, unidad)
    setMarcados((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      localStorage.setItem(CHECK_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const reset = () => {
    setMarcados(new Set())
    localStorage.setItem(CHECK_KEY, '[]')
  }

  return (
    <Modal open={open} onClose={onClose} title="Lista de la compra">
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Bruto para toda la semana{semana != null ? ` · Semana ${semana}` : ''} · {hechos}/
            {total}
          </p>
          {hechos > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-zinc-500 hover:text-accent"
            >
              Desmarcar todo
            </button>
          )}
        </div>

        {grupos.map((g) => (
          <div key={g.categoria}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
              {g.categoria}
            </p>
            <ul className="flex flex-col divide-y divide-ink-border/50">
              {g.lineas.map((l) => {
                const k = keyOf(l.nombre, l.unidad)
                const check = marcados.has(k)
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => toggle(l.nombre, l.unidad)}
                      className="flex w-full items-center gap-3 py-2.5 text-left"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          check ? 'border-accent bg-accent text-accent-ink' : 'border-zinc-600'
                        }`}
                      >
                        {check && (
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`flex-1 text-sm ${
                          check ? 'text-zinc-600 line-through' : 'text-zinc-200'
                        }`}
                      >
                        {l.nombre}
                      </span>
                      <span
                        className={`shrink-0 font-display text-sm font-semibold ${
                          check ? 'text-zinc-600 line-through' : 'text-zinc-400'
                        }`}
                      >
                        {formatCantidad(l)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        <p className="text-[11px] leading-relaxed text-zinc-600">
          Calculado sumando cada ingrediente por los días que aparece. Redondea al alza
          en el súper (algunos productos vienen en formatos fijos).
        </p>
      </div>
    </Modal>
  )
}

function keyOf(nombre: string, unidad: string | null): string {
  return `${nombre.toLowerCase()}||${unidad ?? ''}`
}
