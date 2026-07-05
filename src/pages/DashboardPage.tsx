import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { HABIT_KEYS, HABIT_LABELS, useAllLogs, type HabitKey } from '../hooks/useAllLogs'
import { addDays, completionPct, computeStreaks } from '../lib/streaks'
import { dailyPoints } from '../lib/score'
import { isoWeekday, localDateStr } from '../lib/days'
import { Heatmap } from '../components/dashboard/Heatmap'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'

const ACCENT = '#a3e635'
const GRID = '#2a2a32'
const MUTED = '#71717a'

const tooltipStyle = {
  backgroundColor: '#17171b',
  border: `1px solid ${GRID}`,
  borderRadius: 12,
  fontSize: 12,
  color: '#f4f4f5',
} as const

interface PesoPunto {
  fecha: string
  kg: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { byFecha, doneSets, earliest, loading } = useAllLogs()
  const today = localDateStr()

  const [ventana, setVentana] = useState<7 | 30 | 90>(30)
  const [ejercicios, setEjercicios] = useState<{ id: string; nombre: string }[]>([])
  const [ejercicioSel, setEjercicioSel] = useState<string>('')
  const [pesoPorEjercicio, setPesoPorEjercicio] = useState<Map<string, PesoPunto[]>>(
    new Map(),
  )

  // Cargas: set_logs (máx por día) + exercise_day_logs, fusionados
  useEffect(() => {
    if (!user) return
    void (async () => {
      const [ex, sl, edl] = await Promise.all([
        supabase.from('exercises').select('id, nombre').order('nombre'),
        supabase.from('set_logs').select('exercise_id, fecha, peso_usado'),
        supabase.from('exercise_day_logs').select('exercise_id, fecha, peso'),
      ])
      const mapa = new Map<string, Map<string, number>>()
      const add = (exId: string, fecha: string, kg: number | null) => {
        if (kg == null) return
        const porFecha = mapa.get(exId) ?? new Map<string, number>()
        porFecha.set(fecha, Math.max(porFecha.get(fecha) ?? 0, kg))
        mapa.set(exId, porFecha)
      }
      for (const r of sl.data ?? []) {
        add(r.exercise_id as string, r.fecha as string, r.peso_usado as number | null)
      }
      // edl.error (tabla sin crear) se ignora: simplemente no aporta puntos
      for (const r of edl.data ?? []) {
        add(r.exercise_id as string, r.fecha as string, r.peso as number | null)
      }
      const series = new Map<string, PesoPunto[]>()
      for (const [exId, porFecha] of mapa) {
        series.set(
          exId,
          [...porFecha.entries()]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([fecha, kg]) => ({ fecha, kg })),
        )
      }
      const conDatos = ((ex.data ?? []) as { id: string; nombre: string }[]).filter((e) =>
        series.has(e.id),
      )
      setEjercicios(conDatos)
      setPesoPorEjercicio(series)
      setEjercicioSel((sel) => sel || (conDatos[0]?.id ?? ''))
    })()
  }, [user])

  const rachas = useMemo(() => {
    const r = {} as Record<HabitKey, ReturnType<typeof computeStreaks>>
    for (const k of HABIT_KEYS) r[k] = computeStreaks(doneSets[k], today, earliest)
    return r
  }, [doneSets, earliest, today])

  const puntos = useMemo(() => {
    const monday = addDays(today, -(isoWeekday() - 1))
    const first = today.slice(0, 8) + '01'
    let semana = 0
    let mes = 0
    for (const [fecha, log] of byFecha) {
      const p = dailyPoints(log).points
      if (fecha >= monday && fecha <= today) semana += p
      if (fecha >= first && fecha <= today) mes += p
    }
    const perfectos = [...byFecha.values()].filter((l) => dailyPoints(l).perfect).length
    return { semana, mes, perfectos }
  }, [byFecha, today])

  const mensajes = useMemo(() => {
    const out: string[] = []
    for (const k of HABIT_KEYS) {
      const c = rachas[k].current
      if (c >= 14) {
        out.push(
          `${Math.floor(c / 7)} semanas seguidas cumpliendo ${HABIT_LABELS[k].toLowerCase()}.`,
        )
      } else if (c >= 5) {
        out.push(`${c} días seguidos de ${HABIT_LABELS[k].toLowerCase()}.`)
      }
    }
    const entrenos30 = completionPct(doneSets.exercise_done, today, 30)
    if (entrenos30 >= 50) {
      out.push(`Ejercicio en el ${entrenos30}% de los últimos 30 días.`)
    }
    if (profile) {
      let suma = 0
      for (let i = 0; i < 7; i++) suma += byFecha.get(addDays(today, -i))?.water_ml ?? 0
      const media = suma / 7
      if (media >= profile.water_goal_ml) {
        out.push(`Media de agua de la semana: ${(media / 1000).toFixed(1)} L. Objetivo superado.`)
      }
    }
    return out.slice(0, 2)
  }, [rachas, doneSets, byFecha, profile, today])

  // Series de 30 días para agua y sueño
  const serie30 = useMemo(() => {
    const arr: { dia: string; agua: number; sueno: number | null }[] = []
    for (let i = 29; i >= 0; i--) {
      const fecha = addDays(today, -i)
      const log = byFecha.get(fecha)
      arr.push({
        dia: fecha.slice(8),
        agua: (log?.water_ml ?? 0) / 1000,
        sueno: log?.sleep_hours ?? null,
      })
    }
    return arr
  }, [byFecha, today])

  const seriePeso = ejercicioSel ? (pesoPorEjercicio.get(ejercicioSel) ?? []) : []

  const badges = useMemo(() => {
    const out: { label: string; num: number; ok: boolean }[] = []
    for (const k of HABIT_KEYS) {
      for (const t of [7, 30, 100]) {
        out.push({ label: HABIT_LABELS[k], num: t, ok: rachas[k].best >= t })
      }
    }
    for (const t of [7, 30, 100]) {
      out.push({ label: 'Días perfectos', num: t, ok: puntos.perfectos >= t })
    }
    return out
  }, [rachas, puntos.perfectos])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {byFecha.size === 0 && (
        <Card>
          <p className="font-display text-lg font-semibold">Todavía no hay registros</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Marca tus hábitos en la pestaña Hoy o completa un entrenamiento y este
            panel cobrará vida: rachas, heatmap, gráficas y logros.
          </p>
        </Card>
      )}

      {/* Mensajes de refuerzo con datos reales */}
      {mensajes.length > 0 && (
        <Card className="border-accent/30">
          {mensajes.map((m) => (
            <p key={m} className="text-sm font-medium text-accent">
              {m}
            </p>
          ))}
        </Card>
      )}

      {/* Puntos */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Esta semana', valor: puntos.semana },
          { label: 'Este mes', valor: puntos.mes },
          { label: 'Días perfectos', valor: puntos.perfectos },
        ].map((c) => (
          <Card key={c.label} className="px-3 py-3.5 text-center">
            <p className="font-display text-2xl font-bold text-accent">{c.valor}</p>
            <p className="mt-1 text-[11px] leading-tight text-zinc-500">{c.label}</p>
          </Card>
        ))}
      </div>

      {/* Rachas */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Rachas
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {HABIT_KEYS.map((k) => (
            <div key={k} className="rounded-xl bg-ink-soft px-3.5 py-3">
              <p className="text-xs text-zinc-500">{HABIT_LABELS[k]}</p>
              <p className="mt-0.5 font-display text-2xl font-bold">
                {rachas[k].current}
                <span className="ml-1 text-sm font-medium text-zinc-500">días</span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                mejor: {rachas[k].best}
                {rachas[k].graceInCurrent > 0 &&
                  ` · ${rachas[k].graceInCurrent} ${
                    rachas[k].graceInCurrent === 1 ? 'día' : 'días'
                  } de gracia`}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          Un día fallado no rompe la racha si los 6 anteriores están cumplidos
          (máx. 1 gracia por semana).
        </p>
      </Card>

      {/* % de cumplimiento */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Cumplimiento
          </p>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVentana(n)}
                aria-pressed={ventana === n}
                className={`rounded-lg px-2.5 py-1 font-display text-xs font-semibold transition-colors ${
                  ventana === n
                    ? 'bg-accent text-accent-ink'
                    : 'bg-ink-raised text-zinc-400'
                }`}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {HABIT_KEYS.map((k) => {
            const pct = completionPct(doneSets[k], today, ventana)
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-zinc-400">
                  {HABIT_LABELS[k]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-raised">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-display text-sm font-semibold">
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Heatmap */}
      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Últimas 18 semanas
        </p>
        <Heatmap byFecha={byFecha} today={today} />
      </Card>

      {/* Agua */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Agua · 30 días
        </p>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie30} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: MUTED, fontSize: 10 }} interval={6} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={false} unit="L" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)} L`, 'agua']} />
              {profile && (
                <ReferenceLine y={profile.water_goal_ml / 1000} stroke={MUTED} strokeDasharray="4 4" />
              )}
              <Line type="monotone" dataKey="agua" stroke={ACCENT} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Sueño */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Sueño · 30 días
        </p>
        <div className="mt-2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie30} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: MUTED, fontSize: 10 }} interval={6} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={false} unit="h" domain={[0, 'auto']} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} h`, 'sueño']} />
              {profile && (
                <ReferenceLine y={profile.sleep_goal_hours} stroke={MUTED} strokeDasharray="4 4" />
              )}
              <Line type="monotone" dataKey="sueno" stroke={ACCENT} strokeWidth={2} dot={{ r: 2, fill: ACCENT }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Progresión de cargas */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Progresión de cargas
        </p>
        {ejercicios.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Aún no hay pesos registrados. Marca series en el modo entrenamiento o
            apunta kg en el calendario y aquí verás tu progresión.
          </p>
        ) : (
          <>
            <select
              value={ejercicioSel}
              onChange={(e) => setEjercicioSel(e.target.value)}
              className="mt-2 w-full rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent"
            >
              {ejercicios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={seriePeso.map((p) => ({ ...p, dia: p.fecha.slice(5) }))}
                  margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={false} unit="kg" domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kg`, 'peso']} />
                  <Line type="monotone" dataKey="kg" stroke={ACCENT} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      {/* Badges */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Hitos
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <div
              key={`${b.label}${b.num}`}
              className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                b.ok
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-ink-border bg-ink-soft opacity-50'
              }`}
            >
              <p
                className={`font-display text-xl font-bold ${
                  b.ok ? 'text-accent' : 'text-zinc-500'
                }`}
              >
                {b.num}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{b.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
