export type AiProvider = 'anthropic' | 'openai' | 'google' | 'azure'

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  google: 'Google Gemini',
  azure: 'Azure OpenAI',
}

export interface AiModelOption {
  value: string
  label: string
  note?: string
}

const BASE_MODEL_OPTIONS: Record<AiProvider, AiModelOption[]> = {
  anthropic: [
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Recommended' },
    { value: 'claude-opus-5', label: 'Claude Opus 5', note: 'Most capable' },
    { value: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Fastest, cheapest' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', note: 'Previous generation' },
    { value: 'claude-opus-4-1', label: 'Claude Opus 4.1', note: 'Previous generation' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'Recommended' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
  google: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Recommended' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  azure: [
    { value: 'azure-openai', label: 'Azure deployment default', note: 'Recommended' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini deployment' },
    { value: 'gpt-4o', label: 'GPT-4o deployment' },
  ],
}

export function aiModelOptionsFor(provider: AiProvider, defaultModel?: string | null): AiModelOption[] {
  const options = [...BASE_MODEL_OPTIONS[provider]]

  if (defaultModel && !options.some((option) => option.value === defaultModel)) {
    options.unshift({ value: defaultModel, label: defaultModel, note: 'Provider default' })
  }

  return options
}

export function isKnownAiModel(provider: AiProvider, model: string, defaultModel?: string | null): boolean {
  return aiModelOptionsFor(provider, defaultModel).some((option) => option.value === model)
}
