import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { SubNav } from './SubNav'
import { Sidebar } from './Sidebar'
import { CategoryRail } from './CategoryRail'
import { useTheme } from '@/hooks/useTheme'
import { TesterWalkthroughWidget } from '@/components/TesterWalkthroughWidget'
import { TesterIntroOverlay } from '@/components/TesterIntroOverlay'
import { HelpPanel, useHelpKeyboardShortcut } from '@/components/HelpPanel'
import { AiHelpBubble } from '@/components/AiHelpBubble'
import { ToastLayers } from '@/components/ToastLayers'
import { FranchiseDrillBanner } from '@/components/FranchiseDrillBanner'
import { SubscriptionBanner } from '@/components/SubscriptionBanner'
import { HostedPlanWall } from '@/components/HostedPlanWall'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { SubscriptionSummary } from '@/types/subscription'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { readSnapshot, writeSnapshot } from '@/lib/snapshots'
import { useRealtimeWorkOrders } from '@/hooks/useRealtimeWorkOrders'
import { HELP_HOME_TOPIC_ID, helpTopicForRoute, openHelpTopic } from '@/lib/helpTopics'
import { findSettingsHelpByRoute, settingsHelpTopicId } from '@/lib/settingsHelp'

export function AppLayout() {
  const { theme } = useTheme()
  const { account } = useAuth()
  const subscription = useQuery({
    queryKey: ['tenant-subscription'],
    queryFn: async () => {
      const res = await apiRequest<{ data: SubscriptionSummary }>('/v1/tenant-settings/subscription')
      writeSnapshot('tenant-subscription', res)
      return res
    },
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: () => readSnapshot<{ data: SubscriptionSummary }>('tenant-subscription'),
  })
  // The nav is gated by permissions and modules; on a cold start (no
  // snapshot yet) wait for them too, so the shell paints once, complete.
  const perms = usePermissions()
  const modules = useModuleVisibility()
  const location = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const settingsHelp = findSettingsHelpByRoute(`${location.pathname}${location.search}`)
  const routeHelpTopicId = helpTopicForRoute(`${location.pathname}${location.search}`)
  const contextHelpTopicId = location.pathname === '/tool-shed'
    ? 'settings-overview'
    : settingsHelp
      ? settingsHelpTopicId(settingsHelp.id)
      : routeHelpTopicId
  useRealtimeWorkOrders(account)
  useHelpKeyboardShortcut(setHelpOpen, contextHelpTopicId)
  const openContextHelp = () => {
    openHelpTopic(contextHelpTopicId ?? HELP_HOME_TOPIC_ID)
  }
  const sidebarLayout = theme === 'pro'
  const railLayout = theme === 'rail'

  // Resolve the banner and entitlement before painting the workspace. Otherwise
  // the first request inserts a banner or replaces an already visible page.
  if (subscription.isPending || perms.isLoading || modules.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500" role="status">Loading workspace…</div>
  }

  // Rail shell: the category rail owns navigation entirely, so there is no
  // SubNav under the action bar — the panel already shows where you are and
  // what else is under the same heading.
  if (railLayout) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        <CategoryRail />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar variant="pro" onOpenHelp={openContextHelp} />
          <FranchiseDrillBanner />
          <SubscriptionBanner />
          <main className="flex-1 overflow-y-auto bg-background">
            <HostedPlanWall><Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}><Outlet /></Suspense></HostedPlanWall>
          </main>
        </div>
        <TesterWalkthroughWidget />
        <TesterIntroOverlay />
        <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        <AiHelpBubble />
        <ToastLayers />
      </div>
    )
  }

  // Side bar shell: colored chrome (Sidebar rail + slim TopBar, both driven by
  // --chrome-bg) framing a LIGHT page body. The body stays bg-background so the
  // chrome color never bleeds into content.
  if (sidebarLayout) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        <Sidebar onOpenHelp={openContextHelp} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar variant="pro" onOpenHelp={openContextHelp} />
          <FranchiseDrillBanner />
          <SubscriptionBanner />
          <main className="flex-1 overflow-y-auto bg-background">
            <HostedPlanWall><Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}><Outlet /></Suspense></HostedPlanWall>
          </main>
        </div>
        <TesterWalkthroughWidget />
        <TesterIntroOverlay />
        <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        <AiHelpBubble />
        <ToastLayers />
      </div>
    )
  }

  // Classic theme — original top-nav shell. Default for everyone until
  // they opt into pro from Tool Shed → General → Appearance.
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar onOpenHelp={openContextHelp} />
      <SubNav />
      <FranchiseDrillBanner />
          <SubscriptionBanner />
      <main className="flex-1">
        <HostedPlanWall><Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}><Outlet /></Suspense></HostedPlanWall>
      </main>
      <TesterWalkthroughWidget />
      <TesterIntroOverlay />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AiHelpBubble />
      <ToastLayers />
    </div>
  )
}
