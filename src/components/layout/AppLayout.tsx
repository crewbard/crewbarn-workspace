import { Suspense, useState } from 'react'
import '@/themes/traditional-workspace.css'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BackBar } from './BackBar'
import { useNavTrail } from '@/lib/navTrail'
import { SubNav } from './SubNav'
import { EasySectionTabs } from '@/components/easy/EasySectionTabs'
import { Sidebar } from './Sidebar'
import { CategoryRail } from './CategoryRail'
import { useTheme } from '@/hooks/useTheme'
import '@/components/easy/easy-workspace.css'
import '@/themes/easy-theme.css'
import '@/themes/focus-theme.css'
import { TesterIntroOverlay } from '@/components/TesterIntroOverlay'
import { HelpPanel, useHelpKeyboardShortcut } from '@/components/HelpPanel'
import { KeyboardShortcuts } from '@/components/shortcuts/KeyboardShortcuts'
import { AiHelpBubble } from '@/components/AiHelpBubble'
import { GuidedTourLayer } from '@/components/guides/GuidedTourLayer'
import { ToastLayers } from '@/components/ToastLayers'
import { FranchiseDrillBanner } from '@/components/FranchiseDrillBanner'
import { SubscriptionBanner } from '@/components/SubscriptionBanner'
import { HostedPlanWall } from '@/components/HostedPlanWall'
import { StartUsingCrewBarnBanner, SubPlanWall } from '@/components/SubPlan'
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
  // Where each page came from, for its back button (BackBar).
  useNavTrail()
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
  const sidebarLayout = theme === 'pro' || theme === 'easy-side'
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const railLayout = theme === 'rail' || theme === 'focus'
  // The routed page with its back link. Easy wraps it in one canvas
  // ([data-easy-canvas], sized by themes/easy-theme.css); other shells don't.
  const page = (
    <>
      <BackBar />
      <HostedPlanWall><SubPlanWall><Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}><Outlet /></Suspense></SubPlanWall></HostedPlanWall>
    </>
  )

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
      <div data-tour={theme === 'focus' ? 'layout-focus' : 'layout-rail'} data-focus-layout={theme === 'focus' ? '' : undefined} className="h-screen flex bg-background overflow-hidden">
        <CategoryRail />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar variant="pro" onOpenHelp={openContextHelp} />
          <FranchiseDrillBanner />
          <SubscriptionBanner />
          <StartUsingCrewBarnBanner />
          <main data-traditional-workspace="rail" data-focus-workspace={theme === 'focus' ? '' : undefined} className="flex-1 overflow-y-auto bg-background">
            <BackBar />
            <HostedPlanWall><SubPlanWall><Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}><Outlet /></Suspense></SubPlanWall></HostedPlanWall>
          </main>
        </div>
        <TesterIntroOverlay />
        <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        <KeyboardShortcuts onHelp={openContextHelp} />
        <AiHelpBubble />
        <GuidedTourLayer />
        <ToastLayers />
      </div>
    )
  }

  // Side bar shell: colored chrome (Sidebar rail + slim TopBar, both driven by
  // --chrome-bg) framing a LIGHT page body. The body stays bg-background so the
  // chrome color never bleeds into content.
  if (sidebarLayout) {
    return (
      <div data-tour={`layout-${theme}`} className="h-screen flex bg-background overflow-hidden">
        <Sidebar onOpenHelp={openContextHelp} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar variant="pro" onOpenHelp={openContextHelp} />
          <FranchiseDrillBanner />
          <SubscriptionBanner />
          <StartUsingCrewBarnBanner />
          <main data-traditional-workspace={!easy ? 'pro' : undefined} data-easy-workspace={easy ? '' : undefined} className="flex-1 overflow-y-auto bg-background">
            {easy && <EasySectionTabs />}
            {easy ? <div data-easy-canvas>{page}</div> : page}
          </main>
        </div>
        <TesterIntroOverlay />
        <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        <KeyboardShortcuts onHelp={openContextHelp} />
        <AiHelpBubble />
        <GuidedTourLayer />
        <ToastLayers />
      </div>
    )
  }

  // Classic theme — original top-nav shell. Default for everyone until
  // they opt into pro from Tool Shed → General → Appearance.
  return (
    <div data-tour={`layout-${theme}`} data-easy-top-shell={easy ? '' : undefined} className="min-h-screen bg-background flex flex-col">
      {easy ? (
        // Easy top: the tabs stay fixed under the bar, as they do in Easy side.
        <div data-easy-top-chrome className="sticky top-0 z-30">
          <TopBar onOpenHelp={openContextHelp} />
          <EasySectionTabs />
        </div>
      ) : (
        <>
          <TopBar onOpenHelp={openContextHelp} />
          <SubNav />
        </>
      )}
      <FranchiseDrillBanner />
          <SubscriptionBanner />
          <StartUsingCrewBarnBanner />
      <main data-traditional-workspace={!easy ? 'classic' : undefined} data-easy-workspace={easy ? '' : undefined} className="flex-1">
        {easy ? <div data-easy-canvas>{page}</div> : page}
      </main>
      <TesterIntroOverlay />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <KeyboardShortcuts onHelp={openContextHelp} />
      <AiHelpBubble />
      <GuidedTourLayer />
      <ToastLayers />
    </div>
  )
}
