import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { error } = await signIn(email, password)
    setEnviando(false)
    if (error) setError(error)
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm animate-fade-up">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Habits
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
          Entra y sigue<br />sumando días.
        </h1>

        <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          )}
          <Button type="submit" disabled={enviando} className="mt-2">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          ¿Primera vez?{' '}
          <Link to="/registro" className="font-semibold text-accent hover:text-accent-bright">
            Crea tu cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
