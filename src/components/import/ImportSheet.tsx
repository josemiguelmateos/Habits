import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ACCEPT_IMPORT, convertirDocumento, extraerDeArchivo } from '../../lib/docImport'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

type Validacion<T> = { ok: true; data: T } | { ok: false; error: string }

interface Props<T> {
  open: boolean
  onClose: () => void
  onChanged: () => void
  tipo: 'rutina' | 'dieta'
  ejemplo: string
  validate: (raw: unknown) => Validacion<T>
  importData: (userId: string, data: T) => Promise<void>
}

type Estado = 'idle' | 'leyendo' | 'analizando' | 'importando'

export function ImportSheet<T>({
  open,
  onClose,
  onChanged,
  tipo,
  ejemplo,
  validate,
  importData,
}: Props<T>) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState<string | null>(null)

  const nombre = tipo === 'rutina' ? 'rutina' : 'dieta'

  const validarEImportar = async (raw: unknown): Promise<boolean> => {
    if (!user) return false
    const v = validate(raw)
    if (!v.ok) {
      setError(v.error)
      return false
    }
    setEstado('importando')
    await importData(user.id, v.data)
    return true
  }

  const onArchivo = async (file: File | undefined) => {
    if (!file || !user) return
    setError(null)
    try {
      let raw: unknown
      if (file.name.toLowerCase().endsWith('.json')) {
        setEstado('leyendo')
        try {
          raw = JSON.parse(await file.text())
        } catch {
          setError('El archivo .json no es válido. Revisa comillas y comas.')
          setEstado('idle')
          return
        }
      } else {
        setEstado('leyendo')
        const ex = await extraerDeArchivo(file)
        setEstado('analizando')
        raw = await convertirDocumento(tipo, ex)
      }
      if (await validarEImportar(raw)) {
        onChanged()
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setEstado('idle')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onPegar = async () => {
    if (!user || !texto.trim()) return
    setError(null)
    let raw: unknown
    try {
      raw = JSON.parse(texto)
    } catch {
      setError('Eso no es JSON válido. Revisa comillas y comas.')
      return
    }
    try {
      if (await validarEImportar(raw)) {
        onChanged()
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setEstado('idle')
    }
  }

  const busy = estado !== 'idle'
  const etiquetaBusy =
    estado === 'leyendo'
      ? 'Leyendo documento…'
      : estado === 'analizando'
        ? 'Analizando con IA…'
        : estado === 'importando'
          ? 'Importando…'
          : null

  return (
    <Modal open={open} onClose={onClose} title={`Importar ${nombre}`}>
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-sm leading-relaxed text-zinc-500">
          Sube tu {nombre} en <span className="text-zinc-300">PDF, Excel o JSON</span>. La app
          lee el documento y detecta qué hay dentro para montar tu {nombre}. Los PDF y Excel
          se interpretan con IA (Claude); el JSON se importa directo.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_IMPORT}
          className="hidden"
          onChange={(e) => void onArchivo(e.target.files?.[0])}
        />
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>
          {etiquetaBusy ?? 'Subir archivo (PDF, Excel o JSON)'}
        </Button>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-ink-border" />o pega el JSON
          <span className="h-px flex-1 bg-ink-border" />
        </div>

        <details className="rounded-xl border border-ink-border bg-ink-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-zinc-400">
            Ver formato de ejemplo
          </summary>
          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-zinc-400">
            {ejemplo}
          </pre>
        </details>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          placeholder={tipo === 'rutina' ? '{ "ejercicios": { … }, "rutina": [ … ] }' : '{ "comidas": [ … ] }'}
          className="rounded-xl border border-ink-border bg-ink-soft px-4 py-3 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent"
        />
        <Button variant="secondary" onClick={() => void onPegar()} disabled={busy || !texto.trim()}>
          Importar JSON pegado
        </Button>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
