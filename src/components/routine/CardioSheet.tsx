import { useEffect, useState } from 'react'
import type { CardioSession } from '../../types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { WEEKDAY_NAMES } from '../../lib/days'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Props {
  /** sesión a editar, o null si se está creando */
  cardio: CardioSession | null
  /** día preseleccionado al crear (null = sheet cerrado si cardio también es null) */
  nuevoWeekday: number | null
  onClose: () => void
  onChanged: () => void
}

/** Crear/editar/borrar cardio, incluido moverlo de día. */
export function CardioSheet({ cardio, nuevoWeekday, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const open = cardio !== null || nuevoWeekday !== null

  const [weekday, setWeekday] = useState(1)
  const [duracion, setDuracion] = useState('')
  const [momento, setMomento] = useState('')
  const [tipo, setTipo] = useState('')
  const [metodo, setMetodo] = useState('')
  const [zona, setZona] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setWeekday(cardio?.weekday ?? nuevoWeekday ?? 1)
    setDuracion(cardio?.duracion_min != null ? String(cardio.duracion_min) : '')
    setMomento(cardio?.momento ?? '')
    setTipo(cardio?.tipo ?? '')
    setMetodo(cardio?.metodo ?? '')
    setZona(cardio?.zona_velocidad ?? '')
    setError(null)
  }, [open, cardio, nuevoWeekday])

  if (!open) return null

  const guardar = async () => {
    if (!user) return
    setGuardando(true)
    setError(null)
    const row = {
      weekday,
      duracion_min: duracion.trim() === '' ? null : parseInt(duracion, 10) || null,
      momento: momento.trim() || null,
      tipo: tipo.trim() || null,
      metodo: metodo.trim() || null,
      zona_velocidad: zona.trim() || null,
    }
    const { error: err } = cardio
      ? await supabase.from('cardio_sessions').update(row).eq('id', cardio.id)
      : await supabase.from('cardio_sessions').insert({ ...row, user_id: user.id })
    setGuardando(false)
    if (err) {
      setError(err.message)
      return
    }
    onChanged()
    onClose()
  }

  const eliminar = async () => {
    if (!cardio) return
    if (!confirm('¿Eliminar esta sesión de cardio?')) return
    await supabase.from('cardio_sessions').delete().eq('id', cardio.id)
    onChanged()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={cardio ? 'Editar cardio' : 'Añadir cardio'}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-400">Día de la semana</label>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
              <button
                key={wd}
                type="button"
                onClick={() => setWeekday(wd)}
                aria-pressed={weekday === wd}
                className={`rounded-lg py-2.5 font-display text-xs font-semibold transition-colors ${
                  weekday === wd
                    ? 'bg-accent text-accent-ink'
                    : 'bg-ink-raised text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {WEEKDAY_NAMES[wd].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Duración (min)"
            type="number"
            inputMode="numeric"
            min={0}
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            placeholder="40"
          />
          <Input
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="elíptica, caminar…"
          />
          <Input
            label="Momento"
            value={momento}
            onChange={(e) => setMomento(e.target.value)}
            placeholder="post-entreno / ayunas"
          />
          <Input
            label="Método"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            placeholder="PROG 3, continuo…"
          />
        </div>
        <Input
          label="Zona / velocidad"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          placeholder="Zona 1, Velocidad 6…"
        />

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <Button onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
        {cardio && (
          <Button
            variant="ghost"
            onClick={() => void eliminar()}
            className="text-red-500 hover:text-red-400"
          >
            Eliminar cardio
          </Button>
        )}
      </div>
    </Modal>
  )
}
