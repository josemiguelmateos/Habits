import { supabase } from './supabase'
import { localDateStr } from './days'
import { addDays, computeStreaks } from './streaks'
import { dailyPoints } from './score'
import { levelFromXp } from './level'
import { isoWeekday } from './days'
import type { DailyLog } from '../types'

export interface Group {
  id: string
  nombre: string
  codigo: string
}

export interface MemberStats {
  user_id: string
  nombre: string | null
  puntos_semana: number
  racha_ejercicio: number
  dias_perfectos: number
  nivel: number
  updated_at: string
}

/** ¿La tabla/función aún no existe? (migración 0004 sin aplicar) */
export function esMigracionPendiente(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883'
}

export async function fetchMyGroups(
  userId: string,
): Promise<{ groups: Group[]; missing: boolean }> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, groups(id, nombre, codigo)')
    .eq('user_id', userId)
  if (error) {
    return { groups: [], missing: esMigracionPendiente(error.code) }
  }
  const groups = (data ?? [])
    .map((r) => r.groups as unknown as Group | null)
    .filter((g): g is Group => g != null)
  return { groups, missing: false }
}

/** Leaderboard de un grupo: miembros + sus stats agregadas, por puntos. */
export async function fetchLeaderboard(groupId: string): Promise<MemberStats[]> {
  const { data: members, error } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
  if (error || !members) return []
  const ids = members.map((m) => m.user_id as string)
  const { data: stats } = await supabase
    .from('member_stats')
    .select('*')
    .in('user_id', ids)
  const byId = new Map(((stats ?? []) as MemberStats[]).map((s) => [s.user_id, s]))
  return ids
    .map(
      (id) =>
        byId.get(id) ?? {
          user_id: id,
          nombre: null,
          puntos_semana: 0,
          racha_ejercicio: 0,
          dias_perfectos: 0,
          nivel: 1,
          updated_at: '',
        },
    )
    .sort((a, b) => b.puntos_semana - a.puntos_semana)
}

let ultimaSync = 0

/**
 * Publica la instantánea agregada del usuario (para el leaderboard).
 * Solo cumplimiento: puntos, racha de ejercicio, días perfectos y nivel.
 * Falla en silencio si la migración 0004 no está aplicada.
 */
export async function syncMemberStats(
  userId: string,
  nombre: string | null,
  logs: DailyLog[],
): Promise<void> {
  if (Date.now() - ultimaSync < 5 * 60 * 1000) return
  const today = localDateStr()
  const monday = addDays(today, -(isoWeekday() - 1))

  let puntosSemana = 0
  let puntosTotal = 0
  let perfectos = 0
  const doneEjercicio = new Set<string>()
  for (const l of logs) {
    const p = dailyPoints(l)
    puntosTotal += p.points
    if (p.perfect) perfectos++
    if (l.fecha >= monday && l.fecha <= today) puntosSemana += p.points
    if (l.exercise_done) doneEjercicio.add(l.fecha)
  }
  const racha = computeStreaks(
    doneEjercicio,
    today,
    logs.length > 0 ? logs[0].fecha : null,
  ).current

  const { error } = await supabase.from('member_stats').upsert({
    user_id: userId,
    nombre,
    puntos_semana: puntosSemana,
    racha_ejercicio: racha,
    dias_perfectos: perfectos,
    nivel: levelFromXp(puntosTotal).level,
    updated_at: new Date().toISOString(),
  })
  if (!error) ultimaSync = Date.now()
}
