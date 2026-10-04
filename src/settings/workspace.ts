import { apiRequest } from '@/lib/api'
import type { SettingDefinition } from '@/settings/types'

/**
 * Where your settings live.
 *
 * The setting that makes the rest of the plan a choice rather than a decree.
 * Company settings are run from Connect so the workspace can get back to
 * being the place work happens — but a one-person shop where the owner is on
 * the dispatch board all day should not have to keep a second site open.
 *
 * Off by default, on purpose. Defaulting to "show them everywhere" would
 * ship the de-bloat to nobody.
 *
 * Nothing is taken away either way: every settings page still resolves in the
 * hosted app, every bookmark still works, and the API still answers. This
 * decides what is listed in a menu. Self-hosted workspaces are a different
 * matter — they are cut without the pages at all — which is why this says
 * "the hosted workspace" rather than "the workspace".
 */

type Where = 'connect' | 'both'

interface WorkspaceData {
  settings_in_workspace: boolean
}

export const settingsLocation: SettingDefinition<Where, WorkspaceData> = {
  key: 'settings-location',
  route: '/tool-shed/settings-location',
  section: 'business',

  title: 'Where your settings live',
  blurb:
    'Settings are run from here, so the app your crew works in stays about the work. If you would rather have them in both places, say so.',
  keywords: ['tool shed', 'menu', 'declutter', 'workspace', 'hide settings', 'connect'],

  permission: 'settings_preferences.edit',

  control: {
    kind: 'choice',
    options: [
      {
        value: 'connect',
        label: 'Only here, on Connect',
        detail:
          'The Tool Shed in the app keeps what people open mid-job — stock, catalogs, assets, vendors, company files — and nothing else. Fewer things to scroll past when someone is on a roof.',
      },
      {
        value: 'both',
        label: 'Here and in the app as well',
        detail:
          'Every setting is listed in both places. Better if one person runs the shop and works the board, and does not want two sites open.',
      },
    ],
  },

  load: async () => {
    const res = await apiRequest<{ data: WorkspaceData }>('/v1/tenant-settings/preferences')
    return { value: res.data.settings_in_workspace ? 'both' : 'connect', data: res.data }
  },

  save: (value) =>
    apiRequest('/v1/tenant-settings/preferences', {
      method: 'PATCH',
      body: { settings_in_workspace: value === 'both' },
    }),

  consequences: (value) =>
    value === 'both'
      ? [
          'Every setting appears in the app’s Tool Shed as well as here.',
          'Anyone whose role already lets them change a setting can change it from either place.',
          'It is the same setting in both — changing it in one changes it in the other.',
        ]
      : [
          'The app’s Tool Shed drops to the things people open while working. Everything else is here.',
          'App layout stays in the app either way — it is saved per browser, so it is a choice about the screen in front of you, not a company rule.',
          'Nothing is hidden from anybody: the pages still open if someone has the link, and their role still decides what they can change.',
        ],

  scopeNote:
    'This only changes what is listed in a menu. No setting is switched off, no page is deleted, and nobody loses a permission.',

  summary: (value) => (value === 'both' ? 'Here and in the app' : 'Only on Connect'),
}
