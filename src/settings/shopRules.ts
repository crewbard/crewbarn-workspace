import { apiRequest } from '@/lib/api'
import type { SettingDefinition } from '@/settings/types'

/**
 * Settings pulled out of "Shop rules".
 *
 * That one page holds about thirty-four separate settings, which is why it is
 * the clearest argument for this whole exercise: nobody scrolling it can tell
 * what any single switch does, and several of them change what a tech is
 * allowed to do mid-job.
 *
 * They are not all separate pages — the ten geofence values are one subject
 * and belong together. What is here is the ones that genuinely stand alone,
 * each written from what the server actually does with it rather than from
 * the field name.
 */

const preferences = () => apiRequest<{ data: Record<string, unknown> }>('/v1/tenant-settings/preferences')
const savePreference = (key: string, value: unknown) =>
  apiRequest('/v1/tenant-settings/preferences', { method: 'PATCH', body: { [key]: value } })

/** A boolean or number straight off the preferences payload. */
function fromPreferences<V>(key: string, fallback: V) {
  return {
    load: async () => {
      const res = await preferences()
      return { value: (res.data[key] ?? fallback) as V, data: null }
    },
    save: (value: V) => savePreference(key, value),
  }
}

// ── reminders before an appointment ──────────────────────────────────────────

export const jobReminders: SettingDefinition<boolean, null> = {
  key: 'workflow.job-reminders',
  route: '/tool-shed/preferences/reminders',
  section: 'workflow',

  title: 'Reminders before an appointment',
  blurb:
    'CrewBarn can message a customer before their appointment, again if the job has not started on time, and once the tech is actually on the way.',
  keywords: ['reminder', 'appointment', 'on my way', 'enroute', 'late', 'notify'],
  permission: 'settings_preferences.edit',

  control: {
    kind: 'toggle',
    on: 'Customers hear from you before the visit without anybody remembering to do it.',
    off: 'Nothing goes out automatically. Anyone who wants to warn a customer has to message them.',
  },

  ...fromPreferences<boolean>('job_reminders_enabled', false),

  consequences: (value) =>
    value
      ? [
          'Your reminder rules run: before the visit, if it starts late, and when the tech is on the way.',
          'Only jobs with a scheduled time and an assigned tech are included.',
          'You choose the wording and the timing in the reminder rules themselves.',
        ]
      : ['No appointment reminders are sent, whatever rules exist.'],

  scopeNote: 'Turning this off leaves your reminder rules saved — it only stops them firing.',

  summary: (value) => (value ? 'On' : 'Off'),
  attention: (value) => (value ? null : 'Appointment reminders are switched off'),
}

// ── stopping work when cash has not been handed in ───────────────────────────

export const codCollection: SettingDefinition<boolean, null> = {
  key: 'money.cod-collection',
  route: '/tool-shed/preferences/cash-collection',
  section: 'money',

  title: 'Stopping new work when cash has not been handed in',
  blurb:
    'When a tech has finished cash-on-delivery jobs and not handed the money in, CrewBarn can stop them starting anything new until they do.',
  keywords: ['cod', 'cash', 'collection', 'hand in', 'block', 'tech'],
  permission: 'settings_preferences.edit',

  control: {
    kind: 'toggle',
    on: 'A tech with cash outstanding cannot start their next job until it is recorded.',
    off: 'Techs can keep working with cash outstanding. You chase it yourself.',
  },

  ...fromPreferences<boolean>('cod_force_collection_enabled', false),

  consequences: (value) =>
    value
      ? [
          'A tech who owes cash sees what is outstanding instead of their next job.',
          'They can carry on once the money is recorded against those jobs.',
          'Individual people can be exempted on their staff record — useful while somebody is training.',
        ]
      : ['Nothing blocks a tech. Uncollected cash still shows in the office, it just does not stop anyone.'],

  scopeNote: 'Only affects cash-on-delivery jobs. Card and invoiced work is never blocked.',

  summary: (value) => (value ? 'Blocks new work' : 'Does not block'),
}

// ── when a job counts as stalled ─────────────────────────────────────────────

export const dormantDays: SettingDefinition<number, null> = {
  key: 'workflow.dormant-days',
  route: '/tool-shed/preferences/stalled-jobs',
  section: 'workflow',

  title: 'When a job counts as stalled',
  blurb:
    'A job nobody has touched for a while gets flagged so it does not sit forgotten. Choose how long "a while" is for your shop.',
  keywords: ['dormant', 'stalled', 'stale', 'forgotten', 'nudge', 'chase'],
  permission: 'settings_preferences.edit',

  control: { kind: 'number', min: 1, max: 365, step: 1, unit: 'days untouched' },

  ...fromPreferences<number>('dormant_days', 7),

  consequences: (value) => [
    `A job with no activity for ${value} ${value === 1 ? 'day' : 'days'} is flagged as stalled.`,
    'It shows up for the office to chase rather than dropping out of sight.',
    'Nothing is sent to the customer, and the job is not changed.',
  ],

  scopeNote: 'Only changes what gets flagged. No job is closed, cancelled or reassigned.',

  summary: (value) => `${value} days`,
}

// ── how long a video from the field can be ───────────────────────────────────

export const maxVideoClip: SettingDefinition<number, null> = {
  key: 'workflow.video-length',
  route: '/tool-shed/preferences/video-length',
  section: 'workflow',

  title: 'How long a video from the field can be',
  blurb:
    'Techs record video on jobs. Longer clips take longer to upload on a bad signal and use more of your storage, so there is a limit.',
  keywords: ['video', 'clip', 'length', 'seconds', 'recording', 'barncam'],
  permission: 'settings_preferences.edit',

  control: { kind: 'number', min: 5, max: 300, step: 5, unit: 'seconds' },

  ...fromPreferences<number>('max_video_clip_seconds', 30),

  consequences: (value) => [
    `The phone app stops recording at ${value} seconds.`,
    value >= 120
      ? 'That is long enough for a walkthrough, but it will be slow to upload from a weak signal.'
      : 'Long enough to show the problem, short enough to upload from a driveway.',
    'Techs can record more than one clip if they need to.',
  ],

  scopeNote: 'Applies to new recordings. Videos already uploaded are untouched.',

  summary: (value) => `${value} seconds`,
}

// ── checking a tech in when they arrive ──────────────────────────────────────

export const autoCheckIn: SettingDefinition<boolean, null> = {
  key: 'workflow.auto-check-in',
  route: '/tool-shed/preferences/auto-check-in',
  section: 'workflow',

  title: 'Checking a tech in when they arrive',
  blurb:
    'CrewBarn can notice from the phone’s location that a tech has reached the job and start the visit for them, instead of waiting for them to press anything.',
  keywords: ['geofence', 'check in', 'arrive', 'gps', 'on site', 'automatic'],
  permission: 'settings_preferences.edit',

  control: {
    kind: 'toggle',
    on: 'Arriving at the address starts the visit on its own.',
    off: 'Techs press "check in" themselves when they get there.',
  },

  ...fromPreferences<boolean>('geofence_auto_checkin_enabled', false),

  consequences: (value) =>
    value
      ? [
          'Reaching the job address starts the visit, so arrival times are honest without anybody remembering.',
          'It needs location turned on in the phone app. Without that, nothing happens and the tech checks in as before.',
          'The tech can still check in by hand if the location is off by a little.',
        ]
      : ['Visits start only when a tech presses check in, so arrival times are as accurate as they remember to be.'],

  scopeNote: 'Only starts visits. It never ends one, and never clocks anybody out.',

  summary: (value) => (value ? 'Automatic' : 'By hand'),
}
