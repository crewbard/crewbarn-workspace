import { useState } from 'react'
import { type AiProvider } from '@/lib/aiModels'
import { type StepProps } from '@/components/onboarding/steps/shared'

/**
 * Let AI help, or do it yourself.
 *
 * The provider picker became cards earlier; this finishes the screen.
 *
 * Two things went. The model dropdown, which asked a new shop to choose
 * between model names on the first screen they ever see — the recommended
 * model is now simply used, and the box for a specific one is folded away for
 * the person who has a reason. And the second key field, which sat in the
 * open asking for an OpenAI key even when OpenAI was the provider and it was
 * therefore pointless; it only appears when it would do something.
 *
 * "Save AI setup" and "Continue manually" were two buttons of equal weight,
 * with Back and Next of equal weight below them — four ways forward and no
 * way to tell which one finishes the step. Saving is the button; doing it by
 * hand is a quiet link, which is what an opt-out should look like.
 *
 * The payload is unchanged.
 */

const PROVIDERS: Array<{ value: AiProvider; label: string; detail: string }> = [
  { value: 'anthropic', label: 'Claude', detail: 'What we recommend. Best at reading photos and messy notes, and it can do things for you.' },
  { value: 'openai', label: 'ChatGPT', detail: 'The one most shops already have. Also turns recorded calls into text on its own.' },
  { value: 'google', label: 'Gemini', detail: 'Cheapest if you use AI heavily. Reads and writes, but will not act for you.' },
  { value: 'azure', label: 'Azure', detail: 'Only if your company already runs on Microsoft Azure.' },
]

/** Where the key comes from, per provider. The question everybody asks. */
const WHERE: Record<AiProvider, string> = {
  anthropic: 'console.anthropic.com → Settings → API keys → Create key. Copy it — they only show it once.',
  openai: 'platform.openai.com → API keys → Create new secret key. Copy it — they only show it once.',
  google: 'aistudio.google.com → Get API key → Create API key.',
  azure: 'Your Azure OpenAI resource → Keys and Endpoint. Your IT team usually has this.',
}

export function AiSetupStep({ onManualSetup, onMarkStep, saving }: StepProps) {
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [transcriptionKey, setTranscriptionKey] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)

  const name = PROVIDERS.find((p) => p.value === aiProvider)?.label ?? 'AI'

  function saveAiGate() {
    if (!aiProvider) {
      setAiError('Pick which AI first.')
      return
    }
    if (!aiKey.trim()) {
      setAiError(`The ${name} key is still empty. Without it nothing runs — or use "I will do this by hand" below.`)
      return
    }
    setAiError(null)
    onMarkStep({
      choice: 'ai_configured',
      ai_provider: aiProvider,
      ai_api_key: aiKey.trim(),
      ai_model: aiModel.trim() || null,
      transcription_openai_api_key: transcriptionKey.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-navy-900">Which AI does the thinking</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          You bring an account from one of these. What it costs goes to them, never to us.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const picked = aiProvider === p.value
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={picked}
                onClick={() => setAiProvider(p.value)}
                disabled={saving}
                className={`flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition disabled:opacity-50 ${
                  picked ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    picked ? 'border-amber-500' : 'border-slate-300'
                  }`}
                >
                  {picked && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-navy-900">{p.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{p.detail}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block">
          <span className="text-sm font-bold text-navy-900">Your {name} key</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{WHERE[aiProvider]}</span>
          <input
            type="password"
            value={aiKey}
            onChange={(event) => setAiKey(event.target.value)}
            placeholder={aiProvider === 'anthropic' ? 'sk-ant-…' : aiProvider === 'openai' ? 'sk-…' : 'Your key'}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>
        <p className="mt-2 text-[13px] text-slate-500">Stored encrypted. No other workspace can see it.</p>
      </div>

      {/*
        Only shown when it would do something. With OpenAI as the provider,
        transcription already works, and asking for a second OpenAI key there
        is a question with no right answer.
      */}
      {aiProvider !== 'openai' && (
        <label className="block">
          <span className="text-sm font-bold text-navy-900">
            An OpenAI key as well <span className="font-normal text-slate-400">— optional</span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
            Only needed if you want recorded calls turned into text. {name} cannot do that part; OpenAI can, and the
            two work side by side.
          </span>
          <input
            type="password"
            value={transcriptionKey}
            onChange={(event) => setTranscriptionKey(event.target.value)}
            placeholder="sk-…"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-semibold text-slate-600 hover:text-navy-900">
          Choose a specific model
        </summary>
        <label className="mt-3 block">
          <span className="text-[13px] leading-snug text-slate-500">
            Leave this empty and CrewBarn uses the one we recommend for {name}, which is the right answer for almost
            everybody. Fill it in if you have been told to use a particular model.
          </span>
          <input
            value={aiModel}
            onChange={(event) => setAiModel(event.target.value)}
            placeholder="Leave empty for the recommended one"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>
      </details>

      {aiError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          {aiError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={saveAiGate}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-5 py-3 text-base font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? 'Saving…' : 'Save and carry on'}
        </button>
        <button
          type="button"
          onClick={onManualSetup}
          disabled={saving}
          className="text-sm font-semibold text-slate-500 underline hover:text-navy-900 disabled:opacity-50"
        >
          I will do this by hand
        </button>
      </div>
    </div>
  )
}
