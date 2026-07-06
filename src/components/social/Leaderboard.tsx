import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchLeaderboard, fetchMyGroups, type Group, type MemberStats } from '../../lib/social'
import { Card } from '../ui/Card'

interface Tabla {
  group: Group
  filas: MemberStats[]
}

/** Leaderboard semanal por grupo (solo cumplimiento agregado). */
export function Leaderboard() {
  const { user } = useAuth()
  const [tablas, setTablas] = useState<Tabla[]>([])

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { groups } = await fetchMyGroups(user.id)
      const resultado: Tabla[] = []
      for (const group of groups) {
        resultado.push({ group, filas: await fetchLeaderboard(group.id) })
      }
      setTablas(resultado)
    })()
  }, [user])

  if (tablas.length === 0) return null

  return (
    <>
      {tablas.map(({ group, filas }) => (
        <Card key={group.id}>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Liga · {group.nombre}
            </p>
            <p className="text-[11px] text-zinc-600">puntos esta semana</p>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {filas.map((f, i) => {
              const esYo = f.user_id === user?.id
              return (
                <li
                  key={f.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    esYo ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-ink-soft'
                  }`}
                >
                  <span
                    className={`w-6 shrink-0 text-center font-display text-lg font-bold ${
                      i === 0 ? 'text-accent' : 'text-zinc-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {f.nombre ?? 'Sin nombre'}
                      {esYo && <span className="ml-1.5 text-xs text-accent">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Nv. {f.nivel} · racha {f.racha_ejercicio} · {f.dias_perfectos}{' '}
                      perfectos
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-xl font-bold">
                    {f.puntos_semana}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
    </>
  )
}
