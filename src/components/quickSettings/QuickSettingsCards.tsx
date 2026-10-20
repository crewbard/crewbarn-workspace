import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconCheck, IconClock, IconExternalLink } from '@tabler/icons-react'
import {
  QUICK_SETTINGS_KEY, fetchQuickSettings, saveQuickSettings,
  type QuickAnswer, type QuickQuestion, type QuickSettingsData,
} from '@/lib/quickSettings'

/**
 * The yes/no cards for Quick settings, used in two places:
 *   - onboarding's automations step (`mode="onboarding"`): every question,
 *     suggested answers filled in on the team ones, one save that carries on;
 *   - Connect's Automations page (`mode="connect"`): the same cards to change
 *     an answer any time; only what changed is sent.
 *
 * A card shows the switch's real state. A yes that needs something not set
 * up yet says what it's waiting on and switches on by itself once it's there.
 */
export function QuickSettingsCards({ mode, onSaved }: { mode: 'onboarding' | 'connect'; onSaved?: () => void }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: QUICK_SETTINGS_KEY, queryFn: fetchQuickSettings })
  const [picked, setPicked] = useState<Record<string, QuickAnswer>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [savedNote, setSavedNote] = useState<string | null>(null)

  // What each card starts on: the real state, a waiting yes, or a suggestion.
  useEffect(() => {
    if (!q.data) return
    setPicked((prev) => {
      const next = { ...prev }
      for (const item of q.data.questions) {
        if (!touched.has(item.key) && item.value) next[item.key] = item.value
      }
      return next
    })
  }, [q.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (answers: Record<string, QuickAnswer>) => saveQuickSettings(answers),
    onSuccess: (data: QuickSettingsData) => {
      qc.setQueryData(QUICK_SETTINGS_KEY, data)
      setTouched(new Set())
      const waiting = data.questions.filter((item) => item.waiting_on.length > 0).length
      setSavedNote(waiting ? `Saved. ${waiting} will switch on once what they need is set up.` : 'Saved.')
      for (const key of ['tenant-preferences', 'job-reminder-rules', 'automation-rules', 'onboarding']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      onSaved?.()
    },
  })

  const groups = useMemo(() => {
    const data = q.data
    if (!data) return []
    return data.groups
      .map((g) => ({ ...g, items: data.questions.filter((item) => item.group === g.key) }))
      .filter((g) => g.items.length > 0)
  }, [q.data])

  if (q.isLoading) return <p className="text-sm text-slate-500">Loading your quick settings…</p>
  if (q.isError || !q.data) return <p className="text-sm text-red-700">Quick settings could not be loaded. Try again in a moment.</p>

  const questions = q.data.questions
  const chosen = questions.filter((item) => picked[item.key]).length
  const changed = questions.filter((item) => picked[item.key] && picked[item.key] !== item.value)
  const toSend = mode === 'onboarding'
    ? Object.fromEntries(questions.filter((item) => picked[item.key]).map((item) => [item.key, picked[item.key]]))
    : Object.fromEntries(changed.map((item) => [item.key, picked[item.key]]))
  const nothingToSend = Object.keys(toSend).length === 0

  const pick = (key: string, answer: QuickAnswer) => {
    setPicked((prev) => ({ ...prev, [key]: answer }))
    setTouched((prev) => new Set(prev).add(key))
    setSavedNote(null)
  }

  return (
    <div className="space-y-5" data-tour="quick-settings">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`qs-${g.key}`} className="space-y-2">
          <h3 id={`qs-${g.key}`} className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.label}</h3>
          <ul className="space-y-2">
            {g.items.map((item) => (
              <QuestionCard
                key={item.key}
                item={item}
                value={picked[item.key] ?? null}
                suggested={item.source === 'suggested' && !touched.has(item.key)}
                onPick={(answer) => pick(item.key, answer)}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          data-tour="quick-settings-save"
          disabled={save.isPending || nothingToSend}
          onClick={() => save.mutate(toSend)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {save.isPending ? 'Saving…' : mode === 'onboarding' ? 'Save my answers and carry on' : 'Save changes'}
        </button>
        <span className="text-sm text-slate-500">
          {mode === 'onboarding'
            ? `${chosen} of ${questions.length} answered`
            : changed.length > 0 ? `${changed.length} change${changed.length === 1 ? '' : 's'} to save` : 'Change any answer, any time.'}
        </span>
        {savedNote && <span className="text-sm font-semibold text-emerald-700" role="status">{savedNote}</span>}
        {save.isError && <span className="text-sm font-semibold text-red-700">{(save.error as Error).message}</span>}
      </div>
    </div>
  )
}

function QuestionCard({
  item, value, suggested, onPick,
}: {
  item: QuickQuestion
  value: QuickAnswer | null
  suggested: boolean
  onPick: (answer: QuickAnswer) => void
}) {
  const unready = item.needs.filter((n) => n.ready === false)
  const waiting = item.waiting_on.length > 0 && value === 'yes'

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3.5 sm:flex sm:items-start sm:justify-between sm:gap-4" data-quick-setting={item.key}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-navy-900">{item.question}</span>
          {item.on && !waiting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <IconCheck size={12} stroke={2.5} aria-hidden /> On
            </span>
          )}
          {suggested && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Suggested</span>}
        </div>
        <p className="mt-0.5 text-sm text-slate-600">{item.yes}</p>
        {waiting ? (
          <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[13px] text-amber-800">
            <IconClock size={14} stroke={2} aria-hidden />
            Waiting on {item.waiting_on.map((n) => n.label.toLowerCase()).join(' and ')}. It switches on once that's set up.
            {item.waiting_on.map((n) => <SetUpLink key={n.key} to={n.to} />)}
          </p>
        ) : unready.length > 0 && value !== 'no' ? (
          <p className="mt-1.5 text-[13px] text-slate-500">
            Needs {unready.map((n) => n.label.toLowerCase()).join(' and ')}. Say yes now and it switches on once that's set up.
          </p>
        ) : null}
      </div>
      <div role="radiogroup" aria-label={item.question} className="mt-3 flex shrink-0 gap-1.5 sm:mt-0">
        {(['yes', 'no'] as const).map((answer) => {
          const active = value === answer
          return (
            <button
              key={answer}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(answer)}
              className={`min-h-[40px] min-w-[64px] rounded-lg border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                active
                  ? answer === 'yes'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {answer === 'yes' ? 'Yes' : 'No'}
            </button>
          )
        })}
      </div>
    </li>
  )
}

/** Opens the page where the missing piece is set up, in a new tab, so the answers stay put. */
function SetUpLink({ to }: { to: string }) {
  const href = to + (to.includes('?') ? '&' : '?') + 'onboarding=peek'
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-amber-700 underline-offset-2 hover:underline">
      Set it up <IconExternalLink size={12} stroke={2} aria-hidden />
    </a>
  )
}
