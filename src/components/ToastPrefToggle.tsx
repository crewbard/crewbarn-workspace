import { useToastPref, type ToastArea } from '@/hooks/useToastPrefs'

/**
 * The on/off switch for this area's pop-up alerts, shown on the page the alerts
 * are about — the place you are standing when you decide you have had enough of
 * them, and the same place you would look to get them back.
 *
 * It says "alerts", not "toasts". Nobody outside this codebase calls them that.
 */
export function ToastPrefToggle({ area, label }: { area: ToastArea; label: string }) {
  const [on, setOn] = useToastPref(area)

  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      // The state is in the switch's own colour and position, so the label can
      // stay fixed. A button whose text flips between "on" and "off" leaves you
      // guessing whether it reports the state or the action.
      aria-pressed={on}
      title={
        on
          ? `${label} alerts are on. Click to stop them popping up.`
          : `${label} alerts are off. Click to turn them back on.`
      }
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        on
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
      ].join(' ')}
    >
      <span
        className={[
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          on ? 'bg-amber-500' : 'bg-slate-300',
        ].join(' ')}
        aria-hidden
      >
        <span
          className={[
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all',
            on ? 'left-3.5' : 'left-0.5',
          ].join(' ')}
        />
      </span>
      <span>{on ? 'Alerts on' : 'Alerts off'}</span>
    </button>
  )
}
