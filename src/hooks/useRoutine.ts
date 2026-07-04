import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  CardioSession,
  Exercise,
  RoutineDay,
  RoutineDayExercise,
  RoutineItem,
} from '../types'

export function useRoutine() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [days, setDays] = useState<RoutineDay[]>([])
  const [rawItems, setRawItems] = useState<RoutineDayExercise[]>([])
  const [cardio, setCardio] = useState<CardioSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    setError(null)
    const [ex, ds, its, cs] = await Promise.all([
      supabase.from('exercises').select('*').order('nombre'),
      supabase.from('routine_days').select('*').order('weekday'),
      supabase.from('routine_day_exercises').select('*').order('orden'),
      supabase.from('cardio_sessions').select('*').order('weekday'),
    ])
    const firstError = ex.error ?? ds.error ?? its.error ?? cs.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setExercises((ex.data as Exercise[]) ?? [])
      setDays((ds.data as RoutineDay[]) ?? [])
      setRawItems((its.data as RoutineDayExercise[]) ?? [])
      setCardio((cs.data as CardioSession[]) ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  // Join en cliente: item + su ejercicio
  const items: RoutineItem[] = useMemo(() => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    return rawItems
      .map((it) => ({ ...it, exercise: byId.get(it.exercise_id)! }))
      .filter((it) => it.exercise)
  }, [rawItems, exercises])

  const itemsByDay = useMemo(() => {
    const m = new Map<string, RoutineItem[]>()
    for (const it of items) {
      const list = m.get(it.routine_day_id) ?? []
      list.push(it)
      m.set(it.routine_day_id, list)
    }
    for (const list of m.values()) list.sort((a, b) => a.orden - b.orden)
    return m
  }, [items])

  /** Reordenación optimista + persistencia de `orden` */
  const reorderDay = useCallback(
    async (dayId: string, orderedIds: string[]) => {
      setRawItems((prev) =>
        prev.map((it) =>
          it.routine_day_id === dayId
            ? { ...it, orden: orderedIds.indexOf(it.id) + 1 }
            : it,
        ),
      )
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('routine_day_exercises').update({ orden: i + 1 }).eq('id', id),
        ),
      )
    },
    [],
  )

  const mediaDone = exercises.filter((e) => e.video_url || e.photo_url).length

  return {
    exercises,
    days,
    items,
    itemsByDay,
    cardio,
    loading,
    error,
    reload,
    reorderDay,
    mediaDone,
    mediaTotal: exercises.length,
  }
}
