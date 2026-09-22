const DEFAULT_EMOJIS = ['👍', '🙏', '✅', '📸', '🔑', '🚚', '🛠️', '🙂']

export function EmojiBar({
  onPick,
  emojis = DEFAULT_EMOJIS,
}: {
  onPick: (emoji: string) => void
  emojis?: string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-sm hover:border-amber-300 hover:bg-amber-50"
          aria-label={`Insert ${emoji}`}
          title={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export default EmojiBar
