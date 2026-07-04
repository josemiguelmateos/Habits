import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

function aplicarTema(tema: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', tema === 'dark')
  localStorage.setItem('tema', tema)
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const [tema, setTema] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('tema') as 'dark' | 'light') ?? 'dark',
  )

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Sesión
        </p>
        <p className="mt-1 font-medium">
          {(user?.user_metadata?.nombre as string | undefined) ?? 'Sin nombre'}
        </p>
        <p className="text-sm text-zinc-500">{user?.email}</p>
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

      <Card>
        <p className="text-sm leading-relaxed text-zinc-500">
          Objetivo, meta de agua y de sueño se editarán aquí en la Fase 3, cuando
          entren en juego el contador de hidratación y el registro diario.
        </p>
      </Card>

      <Button variant="secondary" onClick={signOut} className="mt-2">
        Cerrar sesión
      </Button>
    </div>
  )
}
