import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CardioSession, RoutineDay, RoutineItem } from '../../types'
import { WEEKDAY_NAMES } from '../../lib/days'
import { supabase } from '../../lib/supabase'
import { Sparkline } from '../exercise/Sparkline'

interface Props {
  weekday: number
  day: RoutineDay | null
  items: RoutineItem[]
  cardio: CardioSession[]
  soloPendientes: boolean
  sparklines: Map<string, number[]>
  onReorder: (dayId: string, orderedIds: string[]) => void
  onOpenItem: (item: RoutineItem) => void
  onAdd: (day: RoutineDay) => void
  onCreateDay: (weekday: number) => void
  onPesoChanged: () => void
  onOpenCardio: (c: CardioSession) => void
  onAddCardio: (weekday: number) => void
}

export function DayCard({
  weekday,
  day,
  items,
  cardio,
  soloPendientes,
  sparklines,
  onReorder,
  onOpenItem,
  onAdd,
  onCreateDay,
  onPesoChanged,
  onOpenCardio,
  onAddCardio,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  const visibles = soloPendientes
    ? items.filter((it) => !it.exercise.video_url && !it.exercise.photo_url)
    : items

  const onDragEnd = (e: DragEndEvent) => {
    if (!day || !e.over || e.active.id === e.over.id) return
    const ids = items.map((i) => i.id)
    const from = ids.indexOf(String(e.active.id))
    const to = ids.indexOf(String(e.over.id))
    onReorder(day.id, arrayMove(ids, from, to))
  }

  const esDescanso = !day && cardio.length === 0

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-ink-border/60 px-5 py-3.5">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {WEEKDAY_NAMES[weekday]}
          </p>
          <h3 className="font-display text-lg font-semibold leading-tight">
            {day?.titulo ?? (cardio.length > 0 ? 'Solo cardio' : 'Descanso')}
          </h3>
        </div>
        {day && (
          <button
            type="button"
            onClick={() => onAdd(day)}
            aria-label={`Añadir ejercicio a ${day.titulo}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-raised text-zinc-400 transition-colors hover:text-accent"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </header>

      {esDescanso ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-zinc-500">
            {weekday === 7 ? 'Descanso total. Recupera.' : 'Sin entrenamiento asignado.'}
          </p>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => onCreateDay(weekday)}
              className="text-xs font-semibold text-accent hover:text-accent-bright"
            >
              Añadir entrenamiento
            </button>
            <button
              type="button"
              onClick={() => onAddCardio(weekday)}
              className="text-xs font-semibold text-zinc-500 hover:text-accent"
            >
              + Cardio
            </button>
          </div>
        </div>
      ) : (
        <>
          {day && visibles.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={visibles.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y divide-ink-border/50">
                  {visibles.map((it) => (
                    <SortableRow
                      key={it.id}
                      item={it}
                      dragEnabled={!soloPendientes}
                      sparkValues={sparklines.get(it.exercise_id) ?? []}
                      onOpen={() => onOpenItem(it)}
                      onPesoChanged={onPesoChanged}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          {day && visibles.length === 0 && (
            <p className="px-5 py-4 text-sm text-zinc-500">
              {soloPendientes
                ? 'Todo con demostración en este día.'
                : 'Sin ejercicios. Añade el primero con +.'}
            </p>
          )}
          {cardio.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenCardio(c)}
              className="flex w-full items-center gap-3 border-t border-ink-border/60 bg-ink-soft/60 px-5 py-3.5 text-left transition-colors hover:bg-ink-raised/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h3l2.5-5 4 10 2.5-5h6" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">
                  Cardio · {c.tipo ?? '—'} · {c.duracion_min ?? '—'} min
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {[c.momento, c.metodo, c.zona_velocidad].filter(Boolean).join(' · ')}
                </p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          ))}
          <div className="flex justify-end border-t border-ink-border/40 px-5 py-2">
            <button
              type="button"
              onClick={() => onAddCardio(weekday)}
              className="text-xs font-semibold text-zinc-600 transition-colors hover:text-accent"
            >
              + Cardio
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function SortableRow({
  item,
  dragEnabled,
  sparkValues,
  onOpen,
  onPesoChanged,
}: {
  item: RoutineItem
  dragEnabled: boolean
  sparkValues: number[]
  onOpen: () => void
  onPesoChanged: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !dragEnabled })

  const tieneMedia = Boolean(item.exercise.video_url || item.exercise.photo_url)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2.5 ${isDragging ? 'z-10 bg-ink-raised' : ''}`}
    >
      {dragEnabled && (
        <button
          type="button"
          aria-label="Reordenar"
          className="touch-none cursor-grab px-1 py-2 text-zinc-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
          </svg>
        </button>
      )}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          aria-label={tieneMedia ? 'Con demostración' : 'Sin demostración'}
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${tieneMedia ? 'bg-accent' : 'bg-zinc-700'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">
            {item.exercise.nombre}
          </span>
          <span className="block text-xs text-zinc-500">
            {item.exercise.grupo_muscular ?? '—'} · {item.series}×{item.reps} ·{' '}
            {item.descanso_seg}&Prime;
          </span>
        </span>
      </button>
      <Sparkline values={sparkValues} width={56} height={20} className="shrink-0" />
      <PesoChip item={item} onChanged={onPesoChanged} />
    </li>
  )
}

/** Chip de peso editable in situ: lo importante es actualizar KGS en 2 toques. */
function PesoChip({ item, onChanged }: { item: RoutineItem; onChanged: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')

  const guardar = async () => {
    setEditando(false)
    const limpio = valor.trim().replace(',', '.')
    const nuevo = limpio === '' ? null : parseFloat(limpio)
    if (nuevo != null && Number.isNaN(nuevo)) return
    if (nuevo === item.peso) return
    await supabase.from('routine_day_exercises').update({ peso: nuevo }).eq('id', item.id)
    onChanged()
  }

  if (editando) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        defaultValue={item.peso != null ? String(item.peso) : ''}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void guardar()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditando(false)
        }}
        className="w-16 rounded-lg border border-accent bg-ink-soft px-2 py-1.5 text-center font-display text-sm text-zinc-100 outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(item.peso != null ? String(item.peso) : '')
        setEditando(true)
      }}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 font-display text-sm font-semibold transition-colors ${
        item.peso != null
          ? 'bg-ink-raised text-zinc-100 hover:text-accent'
          : 'border border-dashed border-ink-border text-zinc-600 hover:border-accent hover:text-accent'
      }`}
    >
      {item.peso != null ? `${item.peso} kg` : '+ kg'}
    </button>
  )
}
