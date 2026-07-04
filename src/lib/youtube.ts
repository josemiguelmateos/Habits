export interface ParsedYouTube {
  id: string
  /** Segundo de inicio (0 si no hay marca de tiempo) */
  start: number
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** "90", "90s", "1m30s", "1h2m3s" → segundos. Devuelve 0 si no es válido. */
function parseTimeParam(raw: string | null): number {
  if (!raw) return 0
  const plain = raw.match(/^(\d+)s?$/)
  if (plain) return parseInt(plain[1], 10)
  const hms = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!hms || (!hms[1] && !hms[2] && !hms[3])) return 0
  return (
    (parseInt(hms[1] ?? '0', 10) * 3600) +
    (parseInt(hms[2] ?? '0', 10) * 60) +
    parseInt(hms[3] ?? '0', 10)
  )
}

/**
 * Parsea cualquier forma habitual de enlace de YouTube (watch, youtu.be,
 * shorts, embed, live) con parámetros extra (si=, list=…) y marca de tiempo
 * (t=90, t=1m30s, start=75, #t=…). Devuelve null si no es un vídeo válido.
 */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '').toLowerCase()

  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] || null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v')
    } else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/)
      id = m ? m[1] : null
    }
  } else {
    return null
  }

  if (!id || !ID_RE.test(id)) return null

  let start = parseTimeParam(url.searchParams.get('t') ?? url.searchParams.get('start'))
  if (!start && url.hash) {
    const h = url.hash.match(/t=([^&]+)/)
    if (h) start = parseTimeParam(h[1])
  }

  return { id, start }
}

/** URL del iframe (patrón facade: solo se carga tras la interacción). */
export function buildEmbedUrl(id: string, start = 0): string {
  const base = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
  return start > 0 ? `${base}&start=${start}` : base
}

export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
