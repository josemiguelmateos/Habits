import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function SignupPage() {
  const { session, signUp } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { error } = await signUp(email, password, nombre)
    setEnviando(false)
    if (error) {
      setError(error)
    } else {
      setOk(true)
    }
  }

  if (ok) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="animate-fade-up">
          <h1 className="font-display text-2xl font-bold">Cuenta creada</h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
            Si tu proyecto de Supabase tiene la confirmación por email activada,
            revisa tu bandeja antes de entrar. Si no, ya puedes iniciar sesión.
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-accent">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm animate-fade-up">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Habits
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
          Crea tu cuenta.
        </h1>

        <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
          <Input
            label="Nombre"
            type="text"
            autoComplete="name"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
          />
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          )}
          <Button type="submit" disabled={enviando} className="mt-2">
            {enviando ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-accent hover:text-accent-bright">
            Entra
          </Link>
        </p>
      </div>
    </div>
  )
}
