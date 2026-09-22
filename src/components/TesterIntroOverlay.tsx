import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
  useAcknowledgeTesterIntro,
  useTesterProgress,
} from '@/hooks/useTester'

/**
 * First-login overlay shown to tester accounts. Cannot be dismissed without
 * acknowledging — clicking outside or pressing Esc does nothing. Once
 * acknowledged it never shows again for this account (server-side flag).
 *
 * Mounted at the AppLayout level so it covers every authenticated page.
 */
export function TesterIntroOverlay() {
  const { account } = useAuth()
  const navigate = useNavigate()
  const isTester = account?.role === 'tester'

  const { data, isLoading } = useTesterProgress(isTester)
  const ack = useAcknowledgeTesterIntro()

  if (!isTester || isLoading || !data) return null
  if (data.data.intro_acknowledged) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white max-w-lg w-full rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 pt-6 pb-2">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Welcome — quick read
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            How testing CrewBarn works
          </h2>
        </div>

        <div className="px-6 py-4 text-sm text-slate-700 space-y-3">
          <p>
            You're set up as a <strong>beta tester</strong>: your workspace is real, it's
            yours, and it's free for life. Run your shop on it — and tell me what's confusing,
            broken, or weird along the way. The one thing Google needs from you: keep the phone
            app installed and use it for 14 days.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
            <div className="font-semibold text-amber-900 text-xs uppercase tracking-wide">
              How it works
            </div>
            <p className="text-amber-900">
              <strong>Bottom-right of every page</strong> — a floating widget shows the
              current test, where to click, and what to look for. Run them in order.
            </p>
            <p className="text-amber-900">
              After each test click <strong>"Done — add notes"</strong>. A short modal asks
              for a "Worked / Confusing / Broke" toggle and a free-text comment. Even
              one-liners are useful — don't overthink it.
            </p>
          </div>

          <div className="text-slate-600 space-y-1 text-xs">
            <div>• Skip any test that's blocked or broken — no penalty.</div>
            <div>• Press <code className="bg-slate-100 px-1 rounded">?</code> from anywhere to open the help guide.</div>
            <div>• Your notes go straight to the platform admin — they're acted on.</div>
            <div>• Reply to any system email and it lands in the same admin inbox.</div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 space-y-2 text-[11px] leading-relaxed text-slate-500">
            <p>
              <strong className="text-slate-700">Your data:</strong> real customers and jobs are
              fine — this is your working account, and it stays yours (export any time under Tool
              Shed → Data Export). Actions are logged for debugging, and your written notes go to
              the CrewBarn team. Seeded <em>sample</em> data may be reset during the beta; what you
              create is never deleted without giving you an export first.
            </p>
            <p>
              <strong className="text-slate-700">Please:</strong> no public screenshots, screen
              recordings or feature write-ups (social media, blogs, forums) until the public launch.
              Telling other shop owners about it is welcome — send them to app.crewbarn.com/beta.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-end">
          <button
            type="button"
            onClick={() => ack.mutate(undefined, { onSuccess: () => navigate('/onboarding') })}
            disabled={ack.isPending}
            className="text-sm px-5 py-2 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold"
          >
            {ack.isPending ? 'Saving…' : 'I agree — let me start'}
          </button>
        </div>
      </div>
    </div>
  )
}
