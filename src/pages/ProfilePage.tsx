import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { getWaterAmounts, setWaterAmounts } from '../lib/waterButtons'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

function aplicarTema(tema: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', tema === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'dark' ? '#0a0a0c' : '#f4f4f5')
  localStorage.setItem('tema', tema)
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile, loading, update } = useProfile()
  const [tema, setTema] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('tema') as 'dark' | 'light') ?? 'dark',
  )

  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [aguaObjetivo, setAguaObjetivo] = useState('')
  const [suenoObjetivo, setSuenoObjetivo] = useState('')
  const [[b1, b2]] = useState<[number, number]>(getWaterAmounts)
  const [boton1, setBoton1] = useState(String(b1))
  const [boton2, setBoton2] = useState(String(b2))
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  useEffect(() => {
    if (!profile) return
    setNombre(profile.nombre ?? '')
    setObjetivo(profile.objetivo)
    setAguaObjetivo(String(profile.water_goal_ml))
    setSuenoObjetivo(String(profile.sleep_goal_hours))
  }, [profile])

  const guardar = async () => {
    setGuardando(true)
    setMensaje(null)
    const agua = parseInt(aguaObjetivo, 10)
    const sueno = parseFloat(suenoObjetivo.replace(',', '.'))
    const err = await update({
      nombre: nombre.trim() || null,
      objetivo: objetivo.trim() || 'Hipertrofia',
      water_goal_ml: Number.isNaN(agua) || agua <= 0 ? 2500 : agua,
      sleep_goal_hours: Number.isNaN(sueno) || sueno <= 0 ? 7 : sueno,
    })
    const n1 = parseInt(boton1, 10)
    const n2 = parseInt(boton2, 10)
    if (!Number.isNaN(n1) && !Number.isNaN(n2) && n1 > 0 && n2 > 0) {
      setWaterAmounts(n1, n2)
    }
    setGuardando(false)
    setMensaje(err ?? 'Guardado')
  }

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Sesión
        </p>
        <p className="mt-1 font-medium">{profile?.nombre ?? 'Sin nombre'}</p>
        <p className="text-sm text-zinc-500">{user?.email}</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Mi perfil
        </p>
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input
          label="Objetivo"
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Hipertrofia, fuerza, definición…"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Agua diaria (ml)"
            type="number"
            inputMode="numeric"
            min={1}
            value={aguaObjetivo}
            onChange={(e) => setAguaObjetivo(e.target.value)}
          />
          <Input
            label="Sueño objetivo (h)"
            type="text"
            inputMode="decimal"
            value={suenoObjetivo}
            onChange={(e) => setSuenoObjetivo(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Botón rápido 1 (ml)"
            type="number"
            inputMode="numeric"
            min={1}
            value={boton1}
            onChange={(e) => setBoton1(e.target.value)}
          />
          <Input
            label="Botón rápido 2 (ml)"
            type="number"
            inputMode="numeric"
            min={1}
            value={boton2}
            onChange={(e) => setBoton2(e.target.value)}
          />
        </div>
        {mensaje && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              mensaje === 'Guardado'
                ? 'bg-accent/10 text-accent'
                : 'border border-red-500/40 bg-red-500/10 text-red-500'
            }`}
          >
            {mensaje === 'Guardado' ? 'Cambios guardados.' : mensaje}
          </p>
        )}
        <Button onClick={() => void guardar()} disabled={guardando || loading}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <p className="font-medium">Tema</p>
          <p className="text-sm text-zinc-500">
            {tema === 'dark' ? 'Oscuro (por defecto)' : 'Claro'}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
        >
          Cambiar a {tema === 'dark' ? 'claro' : 'oscuro'}
        </Button>
      </Card>

      <Button variant="secondary" onClick={signOut} className="mt-2">
        Cerrar sesión
      </Button>
    </div>
  )
}
