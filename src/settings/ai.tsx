import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { PERM } from '@/hooks/usePermissions'
import type { SettingDefinition } from '@/settings/types'

/**
 * Which AI does the thinking.
 *
 * The old screen put the provider, the key, the model, and a grid of every
 * AI task with ACTS/HEARS chips and raw model ids on one page. Four decisions
 * and a reference table at once, in grey 13px, is the page that made Patrick
 * say it strains the eyes — and he is right. This is the first of those four,
 * on its own, in the shape docs/design/connect/README.md asks for: cards
 * rather than a dropdown, one sentence per card about what picking it means,
 * and the consequences written out underneath in plain words.
 *
 * What this page does NOT do, on purpose: pasting the key. That is a
 * different job with a different failure mode, and the brief says anything
 * with keys gets a step-by-step guide. It gets its own screen.
 */

export type AiProvider = 'anthropic' | 'openai' | 'google' | 'azure'

interface AiPayload {
  ai_provider: AiProvider | null
  ai_key_present: boolean
  ai_key_last4: string | null
  ai_model: string | null
  ai_enabled: boolean
  ai_tasks: {
    tasks: Array<{ key: string; label: string; kind: 'text' | 'tools' | 'vision' | 'speech'; ready: boolean }>
    recommendation: { provider: AiProvider; model: string; label: string; current_matches: boolean }
  }
}

/**
 * Providers, described by what a locksmith would notice rather than by
 * architecture. "Long context windows" tells a shop owner nothing; "can't
 * take actions for you" tells them exactly what they lose.
 *
 * The tool-calling split is real and load-bearing: CBI's ask-and-act loop
 * needs a provider that supports tools, which Anthropic and OpenAI do and
 * Google and Azure do not. Hiding that until something silently fails would
 * be the worst version of this page.
 */
const PROVIDERS: Array<{ value: AiProvider; label: string; detail: string }> = [
  {
    value: 'anthropic',
    label: 'Claude',
    detail:
      'What we recommend. Best at reading a key code off a photo or pulling details out of a messy note, and it can do things for you — book a job, draft a text.',
  },
  {
    value: 'openai',
    label: 'ChatGPT',
    detail:
      'The one most shops already have an account with. It can also do things for you, and it is the only one that turns recorded calls into text on its own.',
  },
  {
    value: 'google',
    label: 'Gemini',
    detail:
      'The cheapest if you use AI heavily. It can read and write, but it cannot do things for you — no booking a job or sending a text on your say-so.',
  },
  {
    value: 'azure',
    label: 'Azure',
    detail:
      'Only if your company already runs on Microsoft Azure and your IT wants AI billed there. Same limits as Gemini: it reads and writes, it does not act.',
  },
]

/** Providers whose models can take actions, not just write text. */
const CAN_ACT: AiProvider[] = ['anthropic', 'openai']

const NAME: Record<AiProvider, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  google: 'Gemini',
  azure: 'Azure',
}

export const aiProvider: SettingDefinition<AiProvider | null, AiPayload> = {
  key: 'ai-provider',
  route: '/tool-shed/ai/provider',
  section: 'ai', // CBI has its own area in the settings menu now.

  title: 'Which AI does the thinking',
  blurb:
    'CrewBarn does not run AI itself — you bring an account from one of these companies, and what it costs goes to them, not to us. Pick the one you want and nothing happens until you add a key.',
  keywords: ['ai', 'cbi', 'claude', 'anthropic', 'openai', 'chatgpt', 'gemini', 'google', 'azure', 'model'],

  permission: PERM.SETTINGS_EDIT,

  /*
   * Picking saves, and then carries you on.
   *
   * This is the first of three steps — which AI, its key, what it may do —
   * and behind a save bar it was a dead end: pick Claude, press "Set up the
   * key", and the key screen sends you back to pick an AI, because the pick
   * was still sitting unsaved. Nothing was broken and it looked broken.
   */
  autosave: true,

  next: (value, data) =>
    value && !(data.ai_key_present && data.ai_provider === value)
      ? { to: '/tool-shed/ai/key', label: 'setting up the key' }
      : null,

  control: {
    kind: 'choice',
    options: PROVIDERS,
  },

  load: async () => {
    const res = await apiRequest<{ data: AiPayload }>('/v1/settings/ai')
    return { value: res.data.ai_provider, data: res.data }
  },

  save: (value) => apiRequest('/v1/settings/ai', { method: 'PATCH', body: { ai_provider: value } }),

  /**
   * Written from what the server actually reports, not from a guess. The
   * key question people get wrong is that a key belongs to ONE company, so
   * changing company means the old key stops working — say it rather than
   * letting them discover it when a job draft comes back empty.
   */
  consequences: (value, data) => {
    if (!value) return ['Nothing runs until you pick one.']

    const name = NAME[value]
    const changing = data.ai_provider !== null && data.ai_provider !== value
    const out: string[] = []

    if (changing) {
      out.push(`AI moves from ${NAME[data.ai_provider as AiProvider]} to ${name}. What you are charged moves with it.`)
      out.push(`Your old key stops working — a key only works with the company that issued it. You will paste a ${name} key next.`)
    } else if (!data.ai_key_present) {
      out.push(`Nothing runs yet. The next step is a ${name} key, and there is a guide for getting one.`)
    } else {
      out.push(`${name} keeps doing the work, with the key ending ${data.ai_key_last4 ?? '••••'}.`)
    }

    out.push(
      CAN_ACT.includes(value)
        ? 'It can act on what you ask — booking a job, drafting a text — as well as read and write.'
        : 'It reads and writes, but it will not act on what you ask. Asking CrewBarn to book a job or send a text needs Claude or ChatGPT.',
    )

    if (value !== 'openai') {
      out.push('Turning recorded calls into text needs a ChatGPT key as well. You can add one without changing this.')
    }

    return out
  },

  scopeNote:
    'Nothing is switched on by picking a company. What AI is allowed to do stays exactly as you set it, and AI stays asleep until you turn it on.',

  /**
   * The next step, beside the choice. Picking a company does nothing on its
   * own, and the old page left people staring at a box marked "paste your
   * key" with no idea where to get one — so point at the guide instead.
   */
  aside: (value, data) => {
    if (!value) return null
    const name = NAME[value]
    const changing = data.ai_provider !== null && data.ai_provider !== value
    const needsKey = changing || !data.ai_key_present

    return (
      <div
        className={`rounded-xl border p-4 ${needsKey ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}
      >
        <p className={`text-[15px] font-bold ${needsKey ? 'text-amber-900' : 'text-emerald-900'}`}>
          {needsKey ? `Next: a ${name} key` : `Your ${name} key is in place`}
        </p>
        <p className={`mt-1 text-sm leading-relaxed ${needsKey ? 'text-amber-900' : 'text-emerald-800'}`}>
          {needsKey
            ? `Nothing runs until CrewBarn has one. There is a step-by-step guide — where to get it, then a check that it works.`
            : `Ending ${data.ai_key_last4 ?? '••••'}. Replace it whenever you like; the guide walks through it again.`}
        </p>
        <Link
          to="/tool-shed/ai/key"
          className={`mt-3 inline-block text-sm font-semibold hover:underline ${needsKey ? 'text-amber-800' : 'text-emerald-800'}`}
        >
          {needsKey ? 'Set up the key →' : 'Replace the key →'}
        </Link>
      </div>
    )
  },

  summary: (value, data) =>
    !value
      ? 'Not set'
      : data.ai_key_present
        ? `${NAME[value]} · in use`
        : `${NAME[value]} · needs a key`,

  attention: (value, data) => {
    if (!value) return 'No AI picked yet, so anything that reads photos or drafts for you is off.'
    if (!data.ai_key_present) return `${NAME[value]} is picked but has no key, so nothing is running.`
    return null
  },
}
