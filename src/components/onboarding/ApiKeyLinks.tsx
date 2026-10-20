/**
 * "Get a key" links for the AI and call-transcription keys a shop brings.
 *
 * Every box that asks for somebody else's key now says where that key comes
 * from, as a link that opens the provider's own key page in a new tab, and
 * the same one-line note about cost. Used on the setup step and on the real
 * settings pages, so the answer is the same wherever the question is asked.
 */

export type KeyProvider = 'anthropic' | 'openai' | 'google' | 'azure' | 'assemblyai'

export const KEY_PAGES: Record<KeyProvider, { name: string; href: string; label: string; how: string }> = {
  anthropic: {
    name: 'Claude',
    href: 'https://platform.claude.com/settings/keys',
    label: 'platform.claude.com',
    how: 'Add credit under Billing first, then Settings → API keys → Create key. Copy it right away: it is shown once.',
  },
  openai: {
    name: 'ChatGPT',
    href: 'https://platform.openai.com/api-keys',
    label: 'platform.openai.com',
    how: 'Add credit under Billing first, then API keys → Create new secret key. Copy it right away: it is shown once.',
  },
  google: {
    name: 'Gemini',
    href: 'https://aistudio.google.com/app/apikey',
    label: 'aistudio.google.com',
    how: 'Get API key → Create API key. This is not your Google Maps key.',
  },
  azure: {
    name: 'Azure',
    href: 'https://portal.azure.com',
    label: 'portal.azure.com',
    how: 'Your Azure OpenAI resource → Keys and Endpoint. Your IT team usually has it.',
  },
  assemblyai: {
    name: 'AssemblyAI',
    href: 'https://www.assemblyai.com/dashboard/home',
    label: 'assemblyai.com',
    how: 'Workspace → Manage → API Keys → Create New API Key.',
  },
}

export const KEY_COST_NOTE = 'You pay the provider directly. Most everyday tasks cost less than half a penny.'

/** A small "Get a key" link to the provider's own key page, with the clicks to make there. */
export function GetKeyLink({ provider, showHow = true, className = '' }: { provider: KeyProvider; showHow?: boolean; className?: string }) {
  const page = KEY_PAGES[provider]
  return (
    <div data-tour={`get-key-${provider}`} className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-snug ${className}`}>
      <a
        href={page.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"
      >
        Get a {page.name} key <span aria-hidden="true">↗</span>
      </a>
      {showHow && <span className="text-slate-500">{page.label}: {page.how}</span>}
    </div>
  )
}

/** The one line about what keys cost. */
export function KeyCostNote({ className = '' }: { className?: string }) {
  return (
    <p data-tour="key-cost-note" className={`text-[13px] leading-snug text-slate-600 ${className}`}>
      {KEY_COST_NOTE}
    </p>
  )
}
