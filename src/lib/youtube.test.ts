import { describe, expect, it } from 'vitest'
import { buildEmbedUrl, parseYouTubeUrl } from './youtube'

const ID = 'dQw4w9WgXcQ'

describe('parseYouTubeUrl', () => {
  it('parsea watch?v=', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)).toEqual({
      id: ID,
      start: 0,
    })
  })

  it('parsea youtu.be', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}`)).toEqual({ id: ID, start: 0 })
  })

  it('parsea shorts', () => {
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${ID}`)).toEqual({
      id: ID,
      start: 0,
    })
  })

  it('parsea embed', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}`)).toEqual({
      id: ID,
      start: 0,
    })
  })

  it('ignora parámetros extra tipo si= (botón compartir)', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?si=AbCdEf123456`)).toEqual({
      id: ID,
      start: 0,
    })
  })

  it('soporta t= en segundos', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=90`)).toEqual({ id: ID, start: 90 })
  })

  it('soporta t=1m30s', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toEqual({
      id: ID,
      start: 90,
    })
  })

  it('soporta t=90s y t=1h2m3s', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=90s`)?.start).toBe(90)
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=1h2m3s`)?.start).toBe(3723)
  })

  it('soporta start=', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}?start=75`)?.start).toBe(75)
  })

  it('soporta #t= en el hash', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}#t=45`)?.start).toBe(45)
  })

  it('acepta enlaces sin protocolo y hosts m./music.', () => {
    expect(parseYouTubeUrl(`youtu.be/${ID}`)?.id).toBe(ID)
    expect(parseYouTubeUrl(`https://m.youtube.com/watch?v=${ID}`)?.id).toBe(ID)
  })

  it('acepta espacios alrededor (pegado desde el móvil)', () => {
    expect(parseYouTubeUrl(`  https://youtu.be/${ID}  `)?.id).toBe(ID)
  })

  it('rechaza lo que no es YouTube o no tiene id válido', () => {
    expect(parseYouTubeUrl('https://vimeo.com/12345')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=corto')).toBeNull()
    expect(parseYouTubeUrl('no es una url')).toBeNull()
    expect(parseYouTubeUrl('')).toBeNull()
  })

  it('un t= inválido cae a 0 sin romper', () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=abc`)).toEqual({ id: ID, start: 0 })
  })
})

describe('buildEmbedUrl', () => {
  it('usa youtube-nocookie con playsinline y autoplay', () => {
    expect(buildEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&playsinline=1`,
    )
  })

  it('añade start solo si es > 0', () => {
    expect(buildEmbedUrl(ID, 90)).toContain('&start=90')
    expect(buildEmbedUrl(ID, 0)).not.toContain('start=')
  })
})
