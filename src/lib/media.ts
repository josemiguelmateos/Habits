import { supabase } from './supabase'
import { compressImage } from './image'

const BUCKET = 'exercise-media'
const SIGN_TTL = 60 * 60 * 24 // 24 h

// Cache de URLs firmadas (el bucket es privado)
const cache = new Map<string, { url: string; expires: number }>()

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return hit.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL)
  if (error || !data) return null
  cache.set(path, { url: data.signedUrl, expires: Date.now() + (SIGN_TTL - 60) * 1000 })
  return data.signedUrl
}

/**
 * Comprime y sube la foto de un ejercicio a {user_id}/{exercise_id}.webp,
 * guarda el path en exercises.photo_url y devuelve el path.
 */
export async function uploadExercisePhoto(
  userId: string,
  exerciseId: string,
  file: File,
): Promise<string> {
  const blob = await compressImage(file)
  const path = `${userId}/${exerciseId}.webp`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true })
  if (upErr) throw upErr

  const { error: dbErr } = await supabase
    .from('exercises')
    .update({ photo_url: path })
    .eq('id', exerciseId)
  if (dbErr) throw dbErr

  cache.delete(path) // la foto cambió: invalida la URL firmada
  return path
}

export async function deleteExercisePhoto(exerciseId: string, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
  await supabase.from('exercises').update({ photo_url: null }).eq('id', exerciseId)
  cache.delete(path)
}
