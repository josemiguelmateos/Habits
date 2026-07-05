import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { DailyLog } from '../types'

export const HABIT_KEYS = [
  'exercise_done',
  'diet_done',
  'sleep_done',
  'hydration_done',
] as const

export type HabitKey = (typeof HABIT_KEYS)[number]

export const HABIT_LABELS: Record<HabitKey, string> = {
  exercise_done: 'Ejercicio',
  diet_done: 'Dieta',
  sleep_done: 'Sueño',
  hydration_done: 'Hidratación',
}

/** Histórico completo de daily_log (app personal: pocas filas). */
export function useAllLogs() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('daily_log')
      .select('*')
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        setLogs((data as DailyLog[]) ?? [])
        setLoading(false)
      })
  }, [user])

  const byFecha = useMemo(() => new Map(logs.map((l) => [l.fecha, l])), [logs])

  const doneSets = useMemo(() => {
    const sets = {} as Record<HabitKey, Set<string>>
    for (const k of HABIT_KEYS) sets[k] = new Set<string>()
    for (const l of logs) {
      for (const k of HABIT_KEYS) if (l[k]) sets[k].add(l.fecha)
    }
    return sets
  }, [logs])

  const earliest = logs.length > 0 ? logs[0].fecha : null

  return { logs, byFecha, doneSets, earliest, loading }
}
