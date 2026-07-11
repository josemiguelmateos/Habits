import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDiet } from '../hooks/useDiet'
import { importDietData, importInitialDiet, validateDietaJson } from '../lib/importDiet'
import { supabase } from '../lib/supabase'
import { isoWeekday, WEEKDAY_NAMES } from '../lib/days'
import type { DietMealFull } from '../types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ImportSheet } from '../components/import/ImportSheet'
import { ShoppingListSheet } from '../components/diet/ShoppingListSheet'

const BLANK_KEY = 'habits:dieta-en-blanco'

const EJEMPLO_DIETA = `{
  "objetivo": "Volumen",
  "kcal": 2500,
  "comidas": [
    { "dias": [1, 3, 5], "slot": "Comida", "orden": 1,
      "descripcion": "250 g arroz + pollo + verdura",
      "items": [
        { "nombre": "Arroz", "categoria": "Hidratos", "cantidad": 250, "unidad": "g" },
        { "nombre": "Pollo", "categoria": "Proteínas", "cantidad": 150, "unidad": "g" }
      ] }
  ]
}`

export function DietPage() {
  const { user } = useAuth()
  const dieta = useDiet()
  const hoy = isoWeekday()
  const [diaSel, setDiaSel] = useState(hoy)
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [jsonAbierto, setJsonAbierto] = useState(false)
  const [compraAbierta, setCompraAbierta] = useState(false)
  const [enBlanco, setEnBlanco] = useState(() => localStorage.getItem(BLANK_KEY) === '1')

  const importar = async () => {
    if (!user) return
    setImportando(true)
    setImportError(null)
    try {
      await importInitialDiet(user.id)
      await dieta.reload()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImportando(false)
    }
  }

  const resetear = async () => {
    if (!user) return
    if (!confirm('¿Borrar tu dieta e importar otra?')) return
    await supabase.from('diet_meals').delete().eq('user_id', user.id)
    await supabase.from('diet_meta').delete().eq('user_id', user.id)
    localStorage.removeItem(BLANK_KEY)
    setEnBlanco(false)
    await dieta.reload()
  }

  if (dieta.loading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-28 animate-pulse bg-ink-card" />
        ))}
      </div>
    )
  }

  if (dieta.missing) {
    return (
      <div className="card animate-fade-up px-6 py-12 text-center">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Dieta
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold">Falta una migración</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
          Para activar la dieta, ejecuta{' '}
          <code className="rounded bg-ink-raised px-1.5 py-0.5 text-accent">
            0005_diet.sql
          </code>{' '}
          en el SQL Editor de Supabase.
        </p>
      </div>
    )
  }

  if (dieta.isEmpty && !enBlanco) {
    return (
      <>
        <div className="card flex animate-fade-up flex-col items-center gap-5 px-6 py-12 text-center">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Empieza aquí
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold">Tu dieta semanal</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
              Importa la dieta de ejemplo, pega la tuya en JSON o empieza en blanco. Cada
              día verás qué comidas tocan, y la lista de la compra se calcula sola.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            <Button onClick={() => void importar()} disabled={importando}>
              {importando ? 'Importando…' : 'Importar dieta de ejemplo'}
            </Button>
            <Button variant="secondary" onClick={() => setJsonAbierto(true)}>
              Importar archivo (PDF, Excel o JSON)
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.setItem(BLANK_KEY, '1')
                setEnBlanco(true)
              }}
            >
              Empezar en blanco
            </Button>
          </div>
          {importError && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {importError}
            </p>
          )}
        </div>
        <ImportSheet
          open={jsonAbierto}
          onClose={() => setJsonAbierto(false)}
          onChanged={() => void dieta.reload()}
          tipo="dieta"
          ejemplo={EJEMPLO_DIETA}
          validate={validateDietaJson}
          importData={importDietData}
        />
      </>
    )
  }

  const comidasDia = dieta.mealsForDay(diaSel)

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {/* Cabecera: objetivo + kcal + lista de la compra */}
      <div className="card flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-display text-lg font-bold leading-tight">
            {dieta.meta?.objetivo ?? 'Mi dieta'}
          </p>
          {dieta.meta?.kcal != null && (
            <p className="text-sm text-zinc-500">~{dieta.meta.kcal} kcal/día</p>
          )}
        </div>
        <Button variant="secondary" onClick={() => setCompraAbierta(true)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6h15l-1.5 9h-12z" />
            <path d="M6 6 5 3H3" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          Lista de la compra
        </Button>
      </div>

      {/* Selector de día */}
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
          <button
            key={wd}
            type="button"
            onClick={() => setDiaSel(wd)}
            aria-pressed={diaSel === wd}
            className={`flex flex-col items-center rounded-xl py-2 font-display text-xs font-semibold transition-colors ${
              diaSel === wd
                ? 'bg-accent text-accent-ink'
                : wd === hoy
                  ? 'bg-ink-raised text-accent'
                  : 'bg-ink-raised text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {WEEKDAY_NAMES[wd].slice(0, 2)}
          </button>
        ))}
      </div>

      <p className="px-1 font-display text-sm font-semibold text-zinc-400">
        {WEEKDAY_NAMES[diaSel]}
        {diaSel === hoy && <span className="ml-1.5 text-accent">· hoy</span>}
      </p>

      {comidasDia.length === 0 ? (
        <div className="card px-5 py-6 text-center text-sm text-zinc-500">
          Sin comidas asignadas a este día.
        </div>
      ) : (
        comidasDia.map((m) => <MealCard key={m.id} meal={m} />)
      )}

      {dieta.meta?.notas && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Notas
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{dieta.meta.notas}</p>
        </Card>
      )}

      <button
        type="button"
        onClick={() => void resetear()}
        className="mx-auto mt-1 text-xs font-semibold text-zinc-600 hover:text-accent"
      >
        Borrar dieta e importar otra
      </button>

      <ShoppingListSheet
        open={compraAbierta}
        items={dieta.shoppingItems}
        onClose={() => setCompraAbierta(false)}
      />
    </div>
  )
}

function MealCard({ meal }: { meal: DietMealFull }) {
  return (
    <section className="card px-5 py-4">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {meal.slot}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-200">{meal.descripcion}</p>
      {meal.items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {meal.items.map((it) => (
            <span
              key={it.id}
              className="rounded-lg bg-ink-raised px-2.5 py-1 text-xs text-zinc-400"
            >
              {it.nombre}
              {it.cantidad != null && (
                <span className="ml-1 font-medium text-zinc-300">
                  {it.cantidad}
                  {it.unidad ? ` ${it.unidad}` : ''}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
