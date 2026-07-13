export interface Profile {
  id: string
  nombre: string | null
  objetivo: string
  fecha_inicio: string
  water_goal_ml: number
  sleep_goal_hours: number
  theme: string
}

export interface Exercise {
  id: string
  user_id: string
  nombre: string
  grupo_muscular: string | null
  notas_tecnica: string | null
  search_hint_en: string | null
  photo_url: string | null
  video_url: string | null
}

export interface RoutineDay {
  id: string
  user_id: string
  weekday: number // 1=lunes … 7=domingo
  titulo: string
}

export interface RoutineDayExercise {
  id: string
  user_id: string
  routine_day_id: string
  exercise_id: string
  orden: number
  series: number
  reps: string // texto a propósito ("12+12")
  peso: number | null
  descanso_seg: number
  notas: string | null
}

/** Item de rutina con su ejercicio ya resuelto (join en cliente). */
export interface RoutineItem extends RoutineDayExercise {
  exercise: Exercise
}

export interface CardioSession {
  id: string
  user_id: string
  weekday: number
  duracion_min: number | null
  momento: string | null
  tipo: string | null
  metodo: string | null
  zona_velocidad: string | null
  notas: string | null
}

export interface SetLog {
  id: string
  user_id: string
  exercise_id: string
  fecha: string
  serie: number
  reps_hechas: number | null
  peso_usado: number | null
}

export interface DietMeal {
  id: string
  user_id: string
  dias: number[]
  slot: string
  orden: number
  descripcion: string
  semana: number | null
}

export interface DietMealItem {
  id: string
  user_id: string
  meal_id: string
  nombre: string
  categoria: string | null
  cantidad: number | null
  unidad: string | null
}

export interface DietMeta {
  user_id: string
  objetivo: string | null
  kcal: number | null
  notas: string | null
}

/** Comida con sus items ya resueltos (join en cliente). */
export interface DietMealFull extends DietMeal {
  items: DietMealItem[]
}

/** Registro por ejercicio y fecha (kg reales del día + nota). Migración 0003. */
export interface ExerciseDayLog {
  id: string
  user_id: string
  exercise_id: string
  fecha: string
  peso: number | null
  notas: string | null
}

export interface DailyLog {
  id: string
  user_id: string
  fecha: string
  exercise_done: boolean
  diet_done: boolean
  sleep_done: boolean
  hydration_done: boolean
  water_ml: number
  sleep_hours: number | null
  notas: string | null
}
