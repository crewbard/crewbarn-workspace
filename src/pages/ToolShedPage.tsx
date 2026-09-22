import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  TOOL_SHED_SECTION_BLURBS,
  useVisibleToolShedSections,
  type ToolShedItem,
  type ToolShedSection,
} from '@/components/layout/ToolShedMenu'
import { useToolShedLayout } from '@/hooks/useToolShedLayout'

interface ToolShedCard {
  id: string
  item: ToolShedItem
  sectionTitle: string
}

const QUICK_STARTS = [
  {
    title: 'Set up daily workflow',
    body: 'Job statuses, job types, automations, and templates.',
    links: ['/tool-shed/job-statuses', '/tool-shed/job-types', '/tool-shed/automations', '/custom-documents'],
  },
  {
    title: 'Configure customer experience',
    body: 'Portal visibility, messages, brand, forms, and payment terms.',
    links: ['/tool-shed/website', '/tool-shed/marketplace', '/tool-shed/partner-connections', '/tool-shed/communication', '/tool-shed/brand', '/custom-documents', '/tool-shed/payment-terms'],
  },
  {
    title: 'Prepare inventory',
    body: 'Products, services, stock rules, vendors, and purchase orders.',
    links: ['/catalog/products', '/catalog/services', '/tool-shed/inventory-settings', '/vendors', '/purchase-orders'],
  },
]

export function ToolShedPage() {
  const { sections, isLoading } = useVisibleToolShedSections()
  const [search, setSearch] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const query = search.trim().toLowerCase()
  const allCards = useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          id: item.to,
          item,
          sectionTitle: section.title,
        })),
      ),
    [sections],
  )
  const allIds = useMemo(() => allCards.map((card) => card.id), [allCards])
  const { cards, addCard, removeCard, setOrder, reset } = useToolShedLayout(allIds, allIds)
  const cardById = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards])
  const orderedCards = useMemo(
    () => cards.map((id) => cardById.get(id)).filter(Boolean) as ToolShedCard[],
    [cards, cardById],
  )
  const available = useMemo(
    () => allCards.filter((card) => !cards.includes(card.id)),
    [allCards, cards],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const filtered = useMemo(() => {
    if (!query) return orderedCards
    return orderedCards.filter((card) =>
      [
        card.item.label,
        card.item.to,
        card.sectionTitle,
        TOOL_SHED_SECTION_BLURBS[card.sectionTitle],
        describeToolShedItem(card.item),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [orderedCards, query])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cards.indexOf(String(active.id))
    const newIndex = cards.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setOrder(arrayMove(cards, oldIndex, newIndex))
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Tool Shed</p>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Business setup and controls</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Use cards to jump into the setting you need. Daily work stays in the main
            navigation; Tool Shed is for configuring how the shop runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            Step-by-step setup
          </Link>
          <button
            type="button"
            onClick={() => setCustomizing((value) => !value)}
            className={[
              'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
              customizing
                ? 'border-navy-800 bg-navy-800 text-white'
                : 'border-slate-300 bg-white text-navy-800 hover:bg-slate-50',
            ].join(' ')}
          >
            {customizing ? 'Done' : 'Customize'}
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        {QUICK_STARTS.map((quick) => (
          <QuickStartCard key={quick.title} quick={quick} sections={sections} />
        ))}
      </section>

      {customizing && (
        <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Customize Tool Shed cards</h2>
              <p className="mt-1 text-xs text-slate-500">
                Drag each setting card to move it. Remove settings you do not use, then add them back here later.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              Reset to default
            </button>
          </div>
          <div className="mt-3">
            {available.length === 0 ? (
              <p className="text-xs text-slate-500">Every Tool Shed card is already shown.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {available.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => addCard(card.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-navy-800 hover:border-amber-400 hover:bg-amber-50"
                  >
                    <span className="font-bold text-amber-600">+</span>
                    {card.item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <input
          type="search"
          data-tour="toolshed-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search settings, workflows, integrations..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </div>

      {isLoading && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading Tool Shed...
        </div>
      )}

      {!isLoading && cards.length > 0 && filtered.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No Tool Shed items match your search.
        </div>
      )}

      {!isLoading && cards.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No cards are visible. Click <strong>Customize</strong> to add Tool Shed cards.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((card) => (
              <SortableToolShedCard
                key={card.id}
                card={card}
                customizing={customizing}
                onRemove={() => removeCard(card.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </main>
  )
}

function QuickStartCard({
  quick,
  sections,
}: {
  quick: { title: string; body: string; links: string[] }
  sections: ToolShedSection[]
}) {
  const visibleItems = quick.links
    .map((path) => sections.flatMap((section) => section.items).find((item) => item.to === path))
    .filter(Boolean) as ToolShedItem[]

  if (visibleItems.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="text-sm font-semibold text-navy-900">{quick.title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{quick.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleItems.slice(0, 4).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function SortableToolShedCard({
  card,
  customizing,
  onRemove,
}: {
  card: ToolShedCard
  customizing: boolean
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {customizing && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 shadow-sm hover:text-slate-800 active:cursor-grabbing"
            title="Drag to move"
            aria-label="Drag to move"
          >
            <span className="text-base leading-none">⠿</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-400 shadow-sm hover:border-red-300 hover:text-red-600"
            title="Remove card"
            aria-label="Remove card"
          >
            ×
          </button>
        </div>
      )}
      <ToolShedItemCard card={card} customizing={customizing} />
    </div>
  )
}

function ToolShedItemCard({
  card,
  customizing,
}: {
  card: ToolShedCard
  customizing: boolean
}) {
  const content = (
    <>
      <div className={['p-4', customizing ? 'pr-24' : ''].join(' ')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {card.sectionTitle}
            </p>
            <h2 className="mt-1 text-base font-semibold text-navy-900">{card.item.label}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {describeToolShedItem(card.item)}
            </p>
          </div>
          {card.item.comingSoon && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              Soon
            </span>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-slate-100 px-4 py-3">
        <span className="text-xs font-semibold text-amber-700 group-hover:text-amber-800">
          Open setting →
        </span>
      </div>
    </>
  )

  const className = [
    'group flex h-full min-h-[150px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition',
    customizing ? 'ring-2 ring-amber-300/60' : 'hover:border-amber-300 hover:shadow-md',
  ].join(' ')

  if (customizing) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link to={card.item.to} className={className}>
      {content}
    </Link>
  )
}

function describeToolShedItem(item: ToolShedItem): string {
  if (item.comingSoon) return 'Planned setting.'
  if (item.to.includes('automations')) return 'Rules that run work automatically.'
  if (item.to.includes('templates') || item.to === '/custom-documents') return 'Emails, texts, PDFs, forms, and sign-off sheets.'
  if (item.to.includes('inventory')) return 'Stock behavior, bins, and movement controls.'
  if (item.to.includes('catalog')) return 'Items, pricing, categories, and taxes.'
  if (item.to.includes('communication')) return 'Phone, SMS, email, and sender setup.'
  if (item.to.includes('storage') || item.to.includes('maps')) return 'Storage, map, and address lookup setup.'
  if (item.to.includes('security') || item.to.includes('roles')) return 'Access, permissions, and account safety.'
  if (item.to.includes('marketplace')) return 'Public listing and customer request visibility.'
  if (item.to.includes('appearance')) return 'Layout, color, density, and card views.'
  if (item.to.includes('audit')) return 'Review account and system activity.'
  return 'Open this setup area.'
}
