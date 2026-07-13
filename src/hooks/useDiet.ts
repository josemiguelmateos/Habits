import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { semanaActiva } from '../lib/days'
import type { DietMeal, DietMealFull, DietMealItem, DietMeta } from '../types'
import type { ItemConDias } from '../lib/shoppingList'

/** Tabla/migración 0005 aún sin aplicar. */
function esMigracionPendiente(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

export function useDiet() {
  const { user } = useAuth()
  const [meals, setMeals] = useState<DietMealFull[]>([])
  const [meta, setMeta] = useState<DietMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [mealsRes, itemsRes, metaRes] = await Promise.all([
      supabase.from('diet_meals').select('*').order('orden', { ascending: true }),
      supabase.from('diet_meal_items').select('*'),
      supabase.from('diet_meta').select('*').maybeSingle(),
    ])
    if (mealsRes.error) {
      setMissing(esMigracionPendiente(mealsRes.error.code))
      setMeals([])
      setMeta(null)
      setLoading(false)
      return
    }
    setMissing(false)
    const itemsByMeal = new Map<string, DietMealItem[]>()
    for (const it of (itemsRes.data as DietMealItem[]) ?? []) {
      const arr = itemsByMeal.get(it.meal_id) ?? []
      arr.push(it)
      itemsByMeal.set(it.meal_id, arr)
    }
    setMeals(
      ((mealsRes.data as DietMeal[]) ?? []).map((m) => ({
        ...m,
        items: itemsByMeal.get(m.id) ?? [],
      })),
    )
    setMeta((metaRes.data as DietMeta | null) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const semanas = useMemo(
    () => Math.max(1, meals.reduce((n, m) => Math.max(n, m.semana ?? 0), 0)),
    [meals],
  )

  const mealsForDay = useCallback(
    (weekday: number, semana?: number) => {
      const sem = semana ?? semanaActiva(semanas)
      return meals
        .filter((m) => m.dias.includes(weekday) && (m.semana == null || m.semana === sem))
        .sort((a, b) => a.orden - b.orden)
    },
    [meals, semanas],
  )

  /** Items de la compra de una semana (comidas fijas + las de esa semana). */
  const shoppingItemsForWeek = useCallback(
    (semana?: number): ItemConDias[] => {
      const sem = semana ?? semanaActiva(semanas)
      return meals
        .filter((m) => m.semana == null || m.semana === sem)
        .flatMap((m) =>
          m.items.map((it) => ({
            nombre: it.nombre,
            categoria: it.categoria,
            cantidad: it.cantidad,
            unidad: it.unidad,
            dias: m.dias,
          })),
        )
    },
    [meals, semanas],
  )

  const isEmpty = meals.length === 0

  return {
    meals,
    meta,
    loading,
    missing,
    isEmpty,
    semanas,
    mealsForDay,
    shoppingItemsForWeek,
    reload: load,
  }
}
