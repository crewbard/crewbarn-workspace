/**
 * What the setup guide says and waits for, step by step.
 *
 * The words live in onboarding-workflow.json under "setupLines" (so the
 * recorded voice and the screen never disagree); this file only says which
 * line goes with which part of the page, and what the guide waits for.
 *
 * Parts of the page are found by their data-guide name. The step components
 * carry those names; nothing here reaches into a step's state.
 */
import { CONNECT_URL } from '@/lib/workspaceScope'

export type GuideCtx = {
  /** The element for a data-guide name, inside the open setup window if there is one. */
  el: (name: string) => HTMLElement | null
  /** Value of the n-th text/password box inside a data-guide part. */
  value: (name: string, index?: number) => string
  /** A data-guide-* attribute on a part, e.g. attr('storage-choice', 'mode'). */
  attr: (name: string, key: string) => string
  /** Is this onboarding stage saved? */
  complete: (stageKey: string) => boolean
}

export type GuideBeat = {
  /** Line id in setupLines. */
  line: string
  /** data-guide name to point at. */
  el: string
  title: string
  /** Wait until this is true. Without it the guide moves on after speaking. */
  until?: (g: GuideCtx) => boolean
  /** Line ids said while waiting, when it's met, and on coming back from a link. */
  waiting?: string
  done?: string
  back?: string
  links?: (g: GuideCtx) => Array<[string, string]>
  /** Only run this beat when true. */
  when?: (g: GuideCtx) => boolean
  /** Label for skipping just this beat. */
  optional?: string
  /** Show the which-AI-does-what list. */
  models?: boolean
  /** Show the Cloudflare permissions checklist. */
  cloudflarePerms?: boolean
}

export type GuideStage = { key: string; beats: GuideBeat[] }

const KEY_LINKS: Record<string, [string, string]> = {
  anthropic: ['Create a Claude API key', 'https://console.anthropic.com/settings/keys'],
  openai: ['Create an OpenAI API key', 'https://platform.openai.com/api-keys'],
  google: ['Create a Gemini API key', 'https://aistudio.google.com/app/apikey'],
  azure: ['Open Azure AI Foundry', 'https://ai.azure.com/'],
}
const KEY_PATTERNS: Record<string, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-(proj-)?[A-Za-z0-9_-]{20,}$/,
  google: /^AIza[0-9A-Za-z_-]{20,}$/,
  azure: /^[A-Za-z0-9]{24,}$/,
}

/** What CrewBarn runs for each job. Mirrors AiTaskCatalog on the server. */
export const MODEL_JOBS: Array<[string, string]> = [
  ['Ask CBI, and let it take action', 'Claude Sonnet 5'],
  ['Read photos, plates, VINs, PDFs', 'Claude Sonnet 5'],
  ['Draft jobs from calls and texts', 'Claude Sonnet 5'],
  ['Write reminders and emails', 'Claude Sonnet 5'],
  ['Turn call recordings into text', 'OpenAI Whisper'],
]

/** Cloudflare drops Pages from the pre-filled token link, so three things are done by hand. */
export const CLOUDFLARE_PERMS: Array<{ auto: boolean; what: string }> = [
  { auto: true, what: 'Zone · DNS · Edit' },
  { auto: true, what: 'Account · Workers R2 Storage · Edit' },
  { auto: false, what: 'Account · Cloudflare Pages · Edit' },
  { auto: false, what: 'Zone Resources: All zones' },
  { auto: false, what: 'Account Resources: your account' },
]

const provider = (g: GuideCtx) => g.attr('ai-key-field', 'provider') || 'anthropic'
const byo = (g: GuideCtx) => (g.attr('storage-choice', 'mode') || 'byo') === 'byo'
const cloudflare = (g: GuideCtx) => g.attr('cloudflare', 'state')

export const SETUP_GUIDE: GuideStage[] = [
  { key: 'beta_agreement', beats: [
    { line: 'setup.beta.1', el: 'stage-body', title: 'The beta agreement', until: (g) => g.complete('beta_agreement'), waiting: 'setup.wait.agreement' },
  ] },
  { key: 'ai_setup', beats: [
    { line: 'setup.ai.1', el: 'ai-providers', title: 'First up: AI', models: true },
    { line: 'setup.ai.2', el: 'ai-key-field', title: 'Let’s grab your key',
      until: (g) => (KEY_PATTERNS[provider(g)] ?? /.{20,}/).test(g.value('ai-key-field')),
      links: (g) => [KEY_LINKS[provider(g)] ?? KEY_LINKS.anthropic],
      waiting: 'setup.wait.key', done: 'setup.ai.2.done', back: 'setup.ai.2.back' },
    { line: 'setup.ai.3', el: 'ai-openai-field', title: 'Want call transcripts?', optional: 'Skip transcripts for now',
      when: (g) => !!g.el('ai-openai-field'),
      until: (g) => KEY_PATTERNS.openai.test(g.value('ai-openai-field')) && !g.value('ai-openai-field').startsWith('sk-ant-'),
      links: () => [KEY_LINKS.openai], waiting: 'setup.wait.openai', done: 'setup.ai.3.done', back: 'setup.ai.2.back' },
    { line: 'setup.ai.4', el: 'step-save', title: 'Save it', until: (g) => g.complete('ai_setup'), waiting: 'setup.wait.save' },
  ] },
  { key: 'data_ownership', beats: [
    { line: 'setup.storage.1', el: 'storage-choice', title: 'Where your files live' },
    { line: 'setup.storage.2', el: 'cloudflare', title: 'Connect Cloudflare', cloudflarePerms: true,
      when: (g) => byo(g) && cloudflare(g) === 'none',
      until: (g) => cloudflare(g) === 'connected' || cloudflare(g) === 'done',
      links: () => [['Open Connect Cloudflare', `${CONNECT_URL}/tool-shed/cloudflare`]],
      waiting: 'setup.wait.cloudflare', done: 'setup.storage.2.done', back: 'setup.storage.2.back' },
    { line: 'setup.storage.3', el: 'cloudflare', title: 'Let CrewBarn do the rest',
      when: (g) => byo(g) && cloudflare(g) === 'connected',
      until: (g) => cloudflare(g) === 'done', waiting: 'setup.wait.setupstorage', done: 'setup.storage.3.done' },
    { line: 'setup.storage.4', el: 'maps-block', title: 'One Google key for maps', when: byo,
      until: (g) => /^AIza[0-9A-Za-z_-]{30,}$/.test(g.value('maps-block', -1)),
      links: () => [['Open Google Cloud credentials', 'https://console.cloud.google.com/google/maps-apis/credentials']],
      waiting: 'setup.wait.maps', done: 'setup.storage.4.done', back: 'setup.storage.4.back' },
    { line: 'setup.storage.5', el: 'step-save', title: 'Save it', until: (g) => g.complete('data_ownership'), waiting: 'setup.wait.save' },
  ] },
  { key: 'company_profile', beats: [
    // Inputs in order: name, phone, email, address, website.
    { line: 'setup.company.1', el: 'company-fields', title: 'Your company, your look',
      until: (g) => g.value('company-fields', 0).trim().length > 1 && g.value('company-fields', 1).replace(/\D/g, '').length >= 10,
      waiting: 'setup.wait.company', done: 'setup.company.1.done' },
    { line: 'setup.company.2', el: 'step-save', title: 'Save it', until: (g) => g.complete('company_profile'), waiting: 'setup.wait.save' },
  ] },
  { key: 'trade_seed', beats: [
    { line: 'setup.trade.done', el: 'trade-seed', title: 'Already done', when: (g) => g.complete('trade_seed') },
    { line: 'setup.trade.1', el: 'trade-seed', title: 'Apply your trade pack', when: (g) => !g.complete('trade_seed'),
      until: (g) => g.complete('trade_seed'), waiting: 'setup.wait.trade' },
  ] },
  { key: 'company_assets', beats: [
    { line: 'setup.tools.1', el: 'tools-picker', title: 'Your tools and trucks', until: (g) => g.complete('company_assets'), waiting: 'setup.wait.tools' },
  ] },
  { key: 'inventory_layout', beats: [
    { line: 'setup.stock.1', el: 'stock-picker', title: 'What you keep on the shelf', until: (g) => g.complete('inventory_layout'), waiting: 'setup.wait.stock' },
  ] },
  { key: 'staff', beats: [
    { line: 'setup.crew.1', el: 'crew-invite', title: 'Bring your crew in', until: (g) => g.complete('staff'), waiting: 'setup.wait.crew' },
  ] },
  { key: 'communications', beats: [
    { line: 'setup.comms.1', el: 'comms-choices', title: 'How customers reach you', until: (g) => g.complete('communications'), waiting: 'setup.wait.comms' },
  ] },
  { key: 'services_pricebook', beats: [
    { line: 'setup.price.1', el: 'stage-body', title: 'Check your prices', until: (g) => g.complete('services_pricebook'), waiting: 'setup.wait.confirm' },
  ] },
  { key: 'automations', beats: [
    { line: 'setup.autos.1', el: 'stage-body', title: 'Quick settings', until: (g) => g.complete('automations'), waiting: 'setup.wait.confirm' },
  ] },
  { key: 'launch_review', beats: [
    { line: 'setup.launch.1', el: 'stage-body', title: 'Have a look, then go', until: (g) => g.complete('launch_review'), waiting: 'setup.wait.confirm' },
  ] },
]
