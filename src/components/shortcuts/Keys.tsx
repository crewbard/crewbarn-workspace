import { keyCaps } from '@/lib/shortcuts'

/** A shortcut's keys drawn as key caps: [Ctrl][K], or [G] then [J]. */
export function Keys({ keys, size = 'md' }: { keys: string; size?: 'sm' | 'md' }) {
  const chords = keyCaps(keys)
  if (chords.length === 0) return <span className="text-xs italic text-slate-400">Off</span>
  const cap = size === 'sm'
    ? 'min-w-[1.25rem] px-1 py-px text-[11px]'
    : 'min-w-[1.6rem] px-1.5 py-0.5 text-xs'
  return (
    <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-[11px] text-slate-400">then</span>}
          {chord.map((c, j) => (
            <kbd key={j} className={`${cap} inline-flex justify-center rounded border border-slate-300 border-b-2 bg-white font-sans font-semibold text-slate-700`}>
              {c}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  )
}
