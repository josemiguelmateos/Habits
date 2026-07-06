import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { esMigracionPendiente, fetchMyGroups, type Group } from '../../lib/social'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/** Gestión de grupos de amigos desde el Perfil: crear, unirse, compartir código, salir. */
export function GroupsCard() {
  const { user } = useAuth()
  const [grupos, setGrupos] = useState<Group[]>([])
  const [faltaMigracion, setFaltaMigracion] = useState(false)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!user) return
    const r = await fetchMyGroups(user.id)
    setGrupos(r.groups)
    setFaltaMigracion(r.missing)
  }, [user])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const rpc = async (fn: 'create_group' | 'join_group', args: Record<string, string>) => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) {
      if (esMigracionPendiente(error.code)) setFaltaMigracion(true)
      else setMsg(error.message)
      return false
    }
    await cargar()
    return true
  }

  const crear = async () => {
    if (!nombre.trim()) return
    if (await rpc('create_group', { p_nombre: nombre.trim() })) setNombre('')
  }

  const unirse = async () => {
    if (!codigo.trim()) return
    if (await rpc('join_group', { p_codigo: codigo.trim() })) setCodigo('')
  }

  const salir = async (g: Group) => {
    if (!user) return
    if (!confirm(`¿Salir del grupo "${g.nombre}"?`)) return
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', g.id)
      .eq('user_id', user.id)
    await cargar()
  }

  const copiar = async (g: Group) => {
    try {
      await navigator.clipboard.writeText(g.codigo)
      setCopiado(g.id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      setMsg(`Código: ${g.codigo}`)
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Amigos
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          Comparte el código del grupo para competir en el leaderboard semanal. Solo
          se comparte el cumplimiento (puntos, rachas, nivel) — nunca tus notas.
        </p>
      </div>

      {faltaMigracion ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          Para activar el modo amigos, ejecuta la migración{' '}
          <code className="text-amber-700">0004_friends.sql</code> en el SQL Editor de
          Supabase.
        </p>
      ) : (
        <>
          {grupos.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-ink-soft px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.nombre}</p>
                <button
                  type="button"
                  onClick={() => void copiar(g)}
                  className="mt-0.5 font-display text-lg font-bold tracking-[0.2em] text-accent"
                  title="Copiar código"
                >
                  {copiado === g.id ? '¡Copiado!' : g.codigo}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void salir(g)}
                className="shrink-0 text-xs font-semibold text-zinc-500 hover:text-red-500"
              >
                Salir
              </button>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Crear grupo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del grupo"
              />
            </div>
            <Button
              variant="secondary"
              disabled={busy || !nombre.trim()}
              onClick={() => void crear()}
            >
              Crear
            </Button>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Unirse con código"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </div>
            <Button
              variant="secondary"
              disabled={busy || !codigo.trim()}
              onClick={() => void unirse()}
            >
              Unirme
            </Button>
          </div>
        </>
      )}

      {msg && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {msg}
        </p>
      )}
    </Card>
  )
}
