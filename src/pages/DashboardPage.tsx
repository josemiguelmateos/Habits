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
import { levelFromXp } from '../lib/level'
import { volumen, maxPorEjercicio, formatKg, type SetLike, type PesoFecha } from '../lib/stats'
import { sugerenciaHabito, sugerenciaProgresion, sugerenciaSueno } from '../lib/coach'
import { syncMemberStats } from '../lib/social'
import { analisisGuardado, pedirAnalisisIA, type AnalisisIA } from '../lib/aiCoach'
import { Heatmap } from '../components/dashboard/Heatmap'
import { Leaderboard } from '../components/social/Leaderboard'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import ExerciseProgressChart from '../components/exercise/ExerciseProgressChart'

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
  const { logs, byFecha, doneSets, earliest, loading } = useAllLogs()
  const today = localDateStr()

  const [ia, setIa] = useState<AnalisisIA | null>(analisisGuardado)
  const [iaBusy, setIaBusy] = useState(false)
  const [iaError, setIaError] = useState<string | null>(null)

  // Publica la instantánea agregada para el leaderboard de amigos
  useEffect(() => {
    if (!user || loading || !profile) return
    void syncMemberStats(user.id, profile.nombre, logs)
  }, [user, loading, profile, logs])

  const [ventana, setVentana] = useState<7 | 30 | 90>(30)
  const [ejercicios, setEjercicios] = useState<{ id: string; nombre: string }[]>([])
  const [ejercicioSel, setEjercicioSel] = useState<string>('')
  const [pesoPorEjercicio, setPesoPorEjercicio] = useState<Map<string, PesoPunto[]>>(
    new Map(),
  )
  const [setRows, setSetRows] = useState<SetLike[]>([])
  const [edlRows, setEdlRows] = useState<PesoFecha[]>([])
  const [exNames, setExNames] = useState<Map<string, string>>(new Map())

  // Cargas: set_logs (máx por día) + exercise_day_logs, fusionados
  useEffect(() => {
    if (!user) return
    void (async () => {
      const [ex, sl, edl] = await Promise.all([
        supabase.from('exercises').select('id, nombre').order('nombre'),
        supabase.from('set_logs').select('exercise_id, fecha, reps_hechas, peso_usado'),
        supabase.from('exercise_day_logs').select('exercise_id, fecha, peso'),
      ])
      const sets = (sl.data ?? []) as SetLike[]
      // edl.error (tabla sin crear) se ignora: simplemente no aporta puntos
      const diarios = ((edl.data ?? []) as { exercise_id: string; fecha: string; peso: number | null }[])
      setSetRows(sets)
      setEdlRows(diarios)
      setExNames(
        new Map(((ex.data ?? []) as { id: string; nombre: string }[]).map((e) => [e.id, e.nombre])),
      )

      const mapa = new Map<string, Map<string, number>>()
      const add = (exId: string, fecha: string, kg: number | null) => {
        if (kg == null) return
        const porFecha = mapa.get(exId) ?? new Map<string, number>()
        porFecha.set(fecha, Math.max(porFecha.get(fecha) ?? 0, kg))
        mapa.set(exId, porFecha)
      }
      for (const r of sets) add(r.exercise_id, r.fecha, r.peso_usado)
      for (const r of diarios) add(r.exercise_id, r.fecha, r.peso)
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

  const nivel = useMemo(
    () =>
      levelFromXp(
        [...byFecha.values()].reduce((acc, l) => acc + dailyPoints(l).points, 0),
      ),
    [byFecha],
  )

  const vol = useMemo(() => {
    const monday = addDays(today, -(isoWeekday() - 1))
    const primeroMes = today.slice(0, 8) + '01'
    return {
      semana: volumen(setRows, monday, today),
      mes: volumen(setRows, primeroMes, today),
      total: volumen(setRows),
    }
  }, [setRows, today])

  // Récords personales: máximo histórico por ejercicio, los más recientes primero
  const records = useMemo(() => {
    const maxes = maxPorEjercicio([
      ...setRows.map((s) => ({
        exercise_id: s.exercise_id,
        fecha: s.fecha,
        peso: s.peso_usado,
      })),
      ...edlRows,
    ])
    return [...maxes.entries()]
      .map(([exId, m]) => ({ nombre: exNames.get(exId) ?? '—', ...m }))
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1))
      .slice(0, 8)
  }, [setRows, edlRows, exNames])

  // Coach: sugerencias accionables a partir de tus datos
  const coach = useMemo(() => {
    const out: string[] = []
    for (const [exId, serie] of pesoPorEjercicio) {
      if (out.length >= 2) break
      const sesiones = [...serie]
        .reverse()
        .map((p) => ({ fecha: p.fecha, peso: p.kg, repsOk: true }))
      const s = sugerenciaProgresion(exNames.get(exId) ?? 'Ejercicio', sesiones)
      if (s) out.push(s)
    }
    // Con menos de una semana de historial, los % aún no dicen nada
    const hab =
      byFecha.size >= 7
        ? sugerenciaHabito(
            HABIT_KEYS.map((k) => ({
              nombre: HABIT_LABELS[k],
              pct: completionPct(doneSets[k], today, 14),
            })),
          )
        : null
    if (hab) out.push(hab)
    const horas: number[] = []
    for (let i = 1; i <= 14; i++) {
      const h = byFecha.get(addDays(today, -i))?.sleep_hours
      if (h != null) horas.push(h)
    }
    const su = sugerenciaSueno(horas, profile?.sleep_goal_hours ?? 7)
    if (su) out.push(su)
    return out.slice(0, 3)
  }, [pesoPorEjercicio, exNames, doneSets, byFecha, profile, today])

  const generarIA = async () => {
    setIaBusy(true)
    setIaError(null)
    let sumaAgua = 0
    const horasSueno: number[] = []
    for (let i = 0; i < 14; i++) {
      const l = byFecha.get(addDays(today, -i))
      sumaAgua += l?.water_ml ?? 0
      if (l?.sleep_hours != null) horasSueno.push(l.sleep_hours)
    }
    const resumen: Record<string, unknown> = {
      objetivo: profile?.objetivo ?? 'Hipertrofia',
      nivel: `${nivel.level} (${nivel.name})`,
      dias_registrados: byFecha.size,
      cumplimiento_14d: Object.fromEntries(
        HABIT_KEYS.map((k) => [HABIT_LABELS[k], `${completionPct(doneSets[k], today, 14)}%`]),
      ),
      rachas_actuales: Object.fromEntries(
        HABIT_KEYS.map((k) => [HABIT_LABELS[k], rachas[k].current]),
      ),
      media_agua_ml_14d: Math.round(sumaAgua / 14),
      media_sueno_h_14d: horasSueno.length
        ? Math.round((horasSueno.reduce((a, b) => a + b, 0) / horasSueno.length) * 10) / 10
        : null,
      objetivo_agua_ml: profile?.water_goal_ml,
      objetivo_sueno_h: profile?.sleep_goal_hours,
      volumen_kg: vol,
      records_recientes: records.slice(0, 5).map((r) => `${r.nombre}: ${r.peso} kg (${r.fecha})`),
    }
    try {
      setIa(await pedirAnalisisIA(resumen))
    } catch (e) {
      setIaError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIaBusy(false)
    }
  }

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

      {/* Liga de amigos */}
      <Leaderboard />

      {/* Nivel */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Nivel
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold">
              {nivel.level}
              <span className="ml-2 text-base font-semibold text-accent">
                {nivel.name}
              </span>
            </p>
          </div>
          <p className="text-right text-xs text-zinc-500">
            {nivel.intoLevel}/{nivel.forNext} XP
            <br />
            <span className="text-zinc-600">{nivel.xp} en total</span>
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-raised">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${(nivel.intoLevel / nivel.forNext) * 100}%` }}
          />
        </div>
      </Card>

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

      {/* Coach */}
      {byFecha.size > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Coach
          </p>
          {coach.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {coach.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-300">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>
          )}

          {/* Análisis con IA (Edge Function ai-coach → Claude) */}
          <div className={coach.length > 0 ? 'mt-4 border-t border-ink-border/60 pt-4' : 'mt-2'}>
            {ia && (
              <>
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                  {ia.texto}
                </p>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Análisis IA del{' '}
                  {new Date(`${ia.fecha}T12:00:00`).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </>
            )}
            {iaError && (
              <p className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
                {iaError}
              </p>
            )}
            <Button
              variant="secondary"
              onClick={() => void generarIA()}
              disabled={iaBusy}
              className="mt-3 w-full"
            >
              {iaBusy
                ? 'Analizando…'
                : ia
                  ? 'Regenerar análisis IA'
                  : 'Análisis IA de tu semana'}
            </Button>
          </div>
        </Card>
      )}

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

      {/* Volumen movido */}
      {vol.total > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Volumen movido
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'esta semana', valor: vol.semana },
              { label: 'este mes', valor: vol.mes },
              { label: 'total', valor: vol.total },
            ].map((c) => (
              <div key={c.label}>
                <p className="font-display text-xl font-bold">{formatKg(c.valor)}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{c.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
            <div className="mt-3">
              <ExerciseProgressChart
                bare
                setLogs={setRows.filter((r) => r.exercise_id === ejercicioSel)}
                dayLogs={edlRows.filter((r) => r.exercise_id === ejercicioSel)}
              />
            </div>
          </>
        )}
      </Card>

      {/* Récords personales */}
      {records.length > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Récords personales
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {records.map((r) => (
              <li key={r.nombre} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-zinc-300">{r.nombre}</span>
                <span className="shrink-0 font-display text-sm font-bold">
                  {r.peso} kg
                  <span className="ml-2 font-sans text-xs font-normal text-zinc-600">
                    {new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
