import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localDateStr } from '../lib/days'
import type { DailyLog } from '../types'

type HabitKey = 'exercise_done' | 'diet_done' | 'sleep_done' | 'hydration_done'

/**
 * Registro del día de HOY con las reglas automáticas:
 * - hydration_done se marca solo al alcanzar el objetivo de agua
 * - sleep_done = horas >= objetivo de sueño
 * (la corrección manual sigue disponible con toggleHabit / panel del día)
 */
export function useDailyLog(waterGoal: number | null, sleepGoal: number | null) {
  const { user } = useAuth()
  const fecha = localDateStr()
  const [log, setLog] = useState<Partial<DailyLog> | null>(null)

  useEffect(() => {
    if (!user) return
    void supabase
      .from('daily_log')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()
      .then(({ data }) => setLog(data ?? {}))
  }, [user, fecha])

  const upsert = useCallback(
    async (patch: Partial<DailyLog>) => {
      if (!user) return
      const { data } = await supabase
        .from('daily_log')
        .upsert({ user_id: user.id, fecha, ...patch }, { onConflict: 'user_id,fecha' })
        .select()
        .single()
      if (data) setLog(data)
    },
    [user, fecha],
  )

  const addWater = useCallback(
    (ml: number) => {
      const total = Math.max(0, (log?.water_ml ?? 0) + ml)
      return upsert({
        water_ml: total,
        ...(waterGoal != null ? { hydration_done: total >= waterGoal } : {}),
      })
    },
    [log, upsert, waterGoal],
  )

  const resetWater = useCallback(
    () => upsert({ water_ml: 0, hydration_done: false }),
    [upsert],
  )

  const toggleHabit = useCallback(
    (k: HabitKey) => upsert({ [k]: !log?.[k] }),
    [log, upsert],
  )

  const setSleep = useCallback(
    (hours: number | null) =>
      upsert({
        sleep_hours: hours,
        ...(sleepGoal != null
          ? { sleep_done: hours != null && hours >= sleepGoal }
          : {}),
      }),
    [upsert, sleepGoal],
  )

  return { log, fecha, addWater, resetWater, toggleHabit, setSleep }
}
