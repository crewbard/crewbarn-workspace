import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, getActingTenant } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import {
  openAiHelp,
  pageHelpSeed,
  getAiHelpEnabled,
  setAiHelpEnabled,
  onAiHelpEnabledChange,
  getAiHelpPanelOpen,
  onAiHelpPanelOpenChange,
  getCallToastOpen,
  onCallToastOpenChange,
} from '@/lib/aiHelp'

/**
 * AiHelpBubble — floating, context-aware AI help on every screen.
 *
 * Shows bottom-right whenever (a) the shop's AI is enabled + configured
 * AND (b) the signed-in user hasn't hidden it (per-user localStorage
 * toggle). Tapping it opens the existing AI chat panel seeded with a
 * help question about the current page, so the AI answers "what is this
 * screen / how do I…" with steps + links.
 *
 * A small × hides it for this user; re-enable from Tool Shed → Audit
 * Log's help, or anywhere setAiHelpEnabled(true) is called.
 */
export function AiHelpBubble() {
  const { account } = useAuth()
  const location = useLocation()
  const [userEnabled, setUserEnabled] = useState(getAiHelpEnabled())
  // Hide while the chat panel is open so we don't cover its send button.
  const [panelOpen, setPanelOpen] = useState(getAiHelpPanelOpen())
  // Hide while an incoming-call toast owns the bottom-right corner so the
  // two don't stack.
  const [callToastOpen, setCallToastOpen] = useState(getCallToastOpen())
  // Hide while a modal/dialog is open — the bubble sits bottom-right and
  // would cover modal footer buttons (Save / Create / Cancel). Detect any
  // open dialog by its aria-modal attribute (the Modal primitive sets it).
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => onAiHelpEnabledChange(setUserEnabled), [])
  useEffect(() => onAiHelpPanelOpenChange(setPanelOpen), [])
  useEffect(() => onCallToastOpenChange(setCallToastOpen), [])
  useEffect(() => {
    const check = () =>
      setModalOpen(!!document.querySelector('[aria-modal="true"]'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal'],
    })
    return () => observer.disconnect()
  }, [])

  const hasTenantContext = !!(account?.tenant?.id || getActingTenant())
  const { data } = useQuery({
    queryKey: ['settings', 'ai'],
    queryFn: () =>
      apiRequest<{ data: { ai_enabled: boolean; ai_provider: string | null; ai_key_present: boolean } }>(
        '/v1/settings/ai',
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: hasTenantContext,
  })

  const aiAvailable = !!(
    data?.data.ai_enabled &&
    data?.data.ai_provider &&
    data?.data.ai_key_present
  )

  if (!aiAvailable || !userEnabled || panelOpen || modalOpen || callToastOpen) return null

  function ask() {
    const { prompt, display } = pageHelpSeed(location.pathname)
    openAiHelp(prompt, display)
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 print:hidden">
      <div className="relative group">
        {/* Hide affordance — top-left so it never clashes with the spark. */}
        <button
          type="button"
          onClick={() => setAiHelpEnabled(false)}
          title="Hide CBI"
          className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-slate-700 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
        >
          ×
        </button>
        {/* Round CBI badge — matches the mobile app: amber circle, dark "CBI"
            ink, and a ✦ spark hanging off the top-right edge. */}
        <button
          type="button"
          onClick={ask}
          data-tour="ai-help"
          title="Ask CBI for help with this page"
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-colors"
        >
          <span className="text-base font-extrabold tracking-wider text-[#0B1220]">CBI</span>
          <span className="absolute -top-1 right-1.5 text-sm font-bold leading-none text-[#FDE9C8]">✦</span>
        </button>
      </div>
    </div>
  )
}

