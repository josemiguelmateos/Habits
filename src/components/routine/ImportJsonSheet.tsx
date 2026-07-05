import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { importRoutineData, validateRutinaJson } from '../../lib/importRoutine'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

const FORMATO_EJEMPLO = `{
  "ejercicios": {
    "press_banca": { "nombre": "Press banca", "grupo": "Pecho" },
    "sentadilla": { "nombre": "Sentadilla", "grupo": "Piernas" }
  },
  "rutina": [
    {
      "dia": "lunes",
      "titulo": "Torso",
      "items": [
        { "ejercicio": "press_banca", "orden": 1, "series": 4, "reps": "10", "descanso_seg": 90 }
      ]
    }
  ],
  "cardio": [
    { "dia": "sabado", "duracion_min": 30, "tipo": "caminar" }
  ]
}`

interface Props {
  open: boolean
  onClose: () => void
  onChanged: () => void
}

/** Importación de una rutina propia pegando JSON (para los amigos). */
export function ImportJsonSheet({ open, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  const importar = async () => {
    if (!user) return
    setError(null)
    let raw: unknown
    try {
      raw = JSON.parse(texto)
    } catch {
      setError('Eso no es JSON válido. Revisa comillas y comas.')
      return
    }
    const v = validateRutinaJson(raw)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setImportando(true)
    try {
      await importRoutineData(user.id, v.data)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImportando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pegar rutina (JSON)">
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-sm leading-relaxed text-zinc-500">
          Pega aquí tu rutina en JSON. Consejo: pásale una foto de tu tabla a
          ChatGPT o Claude y pídele que la convierta a este formato.
        </p>
        <details className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-400">
            Ver formato de ejemplo
          </summary>
          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-zinc-400">
            {FORMATO_EJEMPLO}
          </pre>
        </details>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          placeholder='{ "ejercicios": { … }, "rutina": [ … ] }'
          className="rounded-xl border border-ink-border bg-ink-soft px-4 py-3 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent"
        />
        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <Button onClick={() => void importar()} disabled={importando || !texto.trim()}>
          {importando ? 'Importando…' : 'Importar'}
        </Button>
      </div>
    </Modal>
  )
}
