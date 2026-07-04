import { useEffect, useState } from 'react'
import { getSignedPhotoUrl } from '../../lib/media'
import { Spinner } from '../ui/Spinner'

interface Props {
  path: string
  alt: string
}

/** Foto de ejercicio desde el bucket privado (URL firmada, con cache). */
export function ExercisePhoto({ path, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    setFailed(false)
    void getSignedPhotoUrl(path).then((u) => {
      if (!alive) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [path])

  if (failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-ink-raised text-sm text-zinc-500">
        No se pudo cargar la foto
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-ink-raised">
        <Spinner />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="aspect-video w-full rounded-xl bg-black object-cover"
    />
  )
}
