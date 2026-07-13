import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRoutine } from '../hooks/useRoutine'
import { useDiet } from '../hooks/useDiet'
import { useProfile } from '../hooks/useProfile'
import { useDailyLog } from '../hooks/useDailyLog'
import { isoWeekday, localDateStr } from '../lib/days'
import { addDays } from '../lib/streaks'
import { getWaterAmounts } from '../lib/waterButtons'
import { dailyPoints } from '../lib/score'
import { levelFromXp } from '../lib/level'
import { syncMemberStats } from '../lib/social'
import { useAllLogs } from '../hooks/useAllLogs'
import { HydrationRing } from '../components/home/HydrationRing'
import { HabitToggle } from '../components/HabitToggle'

const HABITOS = [
  { key: 'exercise_done', label: 'Ejercicio' },
  { key: 'diet_done', label: 'Dieta' },
  { key: 'sleep_done', label: 'Sueño' },
  { key: 'hydration_done', label: 'Hidratación' },
] as const

export function HomePage() {
  const { user } = useAuth()
  const rutina = useRoutine()
  const dieta = useDiet()
  const { profile } = useProfile()
  const dia = useDailyLog(
    profile?.water_goal_ml ?? null,
    profile?.sleep_goal_hours ?? null,
  )
  const todos = useAllLogs()
  const [amounts] = useState<[number, number]>(getWaterAmounts)
  const [sleepStr, setSleepStr] = useState('')
  const [ayerSinRegistrar, setAyerSinRegistrar] = useState(false)

  useEffect(() => {
    setSleepStr(dia.log?.sleep_hours != null ? String(dia.log.sleep_hours) : '')
  }, [dia.log?.sleep_hours])

  // Publica la instantánea agregada para el leaderboard de amigos
  useEffect(() => {
    if (!user || todos.loading || !profile) return
    void syncMemberStats(user.id, profile.nombre, todos.logs)
  }, [user, todos.loading, profile, todos.logs])

  // Banner discreto si ayer quedó sin registrar (solo si ya hay historial)
  useEffect(() => {
    if (!user) return
    const ayer = addDays(localDateStr(), -1)
    void supabase
      .from('daily_log')
      .select('fecha')
      .lte('fecha', ayer)
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setAyerSinRegistrar(Boolean(data?.length && data[0].fecha < ayer))
      })
  }, [user])

  const nombre =
    profile?.nombre?.split(' ')[0] ??
    (user?.user_metadata?.nombre as string | undefined)?.split(' ')[0]
  const hoy = isoWeekday()

  const comidasHoy = dieta.mealsForDay(hoy)
  const dayHoy = rutina.days.find((d) => d.weekday === hoy) ?? null
  const cardioHoy = rutina.cardio.filter((c) => c.weekday === hoy)
  const itemsHoy = dayHoy ? (rutina.itemsByDay.get(dayHoy.id) ?? []) : []
  const tieneRutina =
    rutina.days.length > 0 || rutina.exercises.length > 0 || rutina.cardio.length > 0

  const puntos = dailyPoints(dia.log)
  const entrenoCompletado = Boolean(dia.log?.exercise_done)
  const nivel = levelFromXp(
    todos.logs.reduce((acc, l) => acc + dailyPoints(l).points, 0),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex animate-fade-up items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {nombre ? `Hola, ${nombre}.` : 'Hola.'}
          </h2>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold leading-none text-accent">
            {puntos.points}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">
            {puntos.perfect ? 'día perfecto' : 'puntos hoy'}
          </p>
        </div>
      </div>

      {/* Nivel: el progreso que nunca baja */}
      {!todos.loading && (
        <div className="animate-fade-up">
          <div className="flex items-baseline justify-between text-[11px]">
            <p className="font-display font-semibold uppercase tracking-wider text-zinc-400">
              Nv. {nivel.level} · {nivel.name}
            </p>
            <p className="text-zinc-600">
              {nivel.intoLevel}/{nivel.forNext} XP
            </p>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-raised">
            <div
              className="h-full rounded-full bg-accent/80 transition-all duration-700"
              style={{ width: `${(nivel.intoLevel / nivel.forNext) * 100}%` }}
            />
          </div>
        </div>
      )}

      {ayerSinRegistrar && (
        <Link
          to="/calendario"
          className="flex animate-fade-up items-center justify-between rounded-xl border border-ink-border bg-ink-soft px-4 py-3 text-sm text-zinc-400 transition-colors hover:border-accent/40"
        >
          <span>Ayer quedó sin registrar.</span>
          <span className="font-semibold text-accent">Completar</span>
        </Link>
      )}

      {/* Entrenamiento de hoy */}
      {!rutina.loading &&
        (dayHoy || cardioHoy.length > 0 ? (
          <Link
            to="/entrenar"
            className="card group flex animate-fade-up items-center justify-between px-5 py-4 transition-colors hover:border-accent/50"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {entrenoCompletado ? (
                  <span className="text-accent">Completado</span>
                ) : (
                  'Hoy toca'
                )}
              </p>
              <p className="mt-1 font-display text-xl font-bold">
                {dayHoy?.titulo ?? 'Cardio'}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {[
                  itemsHoy.length > 0 ? `${itemsHoy.length} ejercicios` : null,
                  ...cardioHoy.map((c) => `cardio ${c.duracion_min ?? '—'} min`),
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </p>
            </div>
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform group-active:scale-95 ${
                entrenoCompletado ? 'bg-accent/15 text-accent' : 'bg-accent text-accent-ink'
              }`}
            >
              {entrenoCompletado ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              )}
            </span>
          </Link>
        ) : !tieneRutina ? (
          <Link
            to="/rutina"
            className="card flex animate-fade-up items-center justify-between px-5 py-4 transition-colors hover:border-accent/50"
          >
            <div>
              <p className="font-display text-lg font-semibold">Monta tu rutina</p>
              <p className="mt-1 text-sm text-zinc-500">
                Importa la de ejemplo, pega la tuya o empieza en blanco.
              </p>
            </div>
            <span className="text-accent">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        ) : null)}

      {/* Comidas de hoy */}
      {!dieta.loading && comidasHoy.length > 0 && (
        <Link
          to="/dieta"
          className="card group flex animate-fade-up items-center justify-between px-5 py-4 transition-colors hover:border-accent/50 [animation-delay:60ms]"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Comidas de hoy
            </p>
            <p className="mt-1 truncate font-display text-base font-semibold">
              {comidasHoy.map((m) => m.slot).join(' · ')}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {comidasHoy.length} comidas
              {dieta.meta?.kcal != null ? ` · ~${dieta.meta.kcal} kcal` : ''}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-raised text-accent">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11" />
              <path d="M16 3c-1.5 0-2.5 1.8-2.5 4.5S14.5 12 16 12v9" />
            </svg>
          </span>
        </Link>
      )}

      {/* Hidratación */}
      <div className="animate-fade-up [animation-delay:80ms]">
        <HydrationRing
          waterMl={dia.log?.water_ml ?? 0}
          goal={profile?.water_goal_ml ?? 2500}
          done={Boolean(dia.log?.hydration_done)}
          amounts={amounts}
          onAdd={(ml) => void dia.addWater(ml)}
          onReset={() => void dia.resetWater()}
          disabled={dia.log === null}
        />
      </div>

      {/* Hábitos de hoy */}
      <div className="grid animate-fade-up grid-cols-2 gap-2.5 [animation-delay:140ms]">
        {HABITOS.map((h) => (
          <HabitToggle
            key={h.key}
            label={h.label}
            active={Boolean(dia.log?.[h.key])}
            disabled={dia.log === null}
            onToggle={() => void dia.toggleHabit(h.key)}
          />
        ))}
      </div>

      {/* Sueño */}
      <div className="card flex animate-fade-up items-center justify-between px-5 py-4 [animation-delay:200ms]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Sueño de anoche
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Objetivo: {profile?.sleep_goal_hours ?? 7} h
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={sleepStr}
            onChange={(e) => setSleepStr(e.target.value)}
            onBlur={() => {
              const v = sleepStr.trim().replace(',', '.')
              const n = v === '' ? null : parseFloat(v)
              void dia.setSleep(n != null && !Number.isNaN(n) ? n : null)
            }}
            placeholder="—"
            className="w-16 rounded-xl border border-ink-border bg-ink-soft px-2 py-2 text-center font-display text-xl font-bold text-zinc-100 outline-none focus:border-accent"
          />
          <span className="text-sm text-zinc-500">h</span>
        </div>
      </div>
    </div>
  )
}
