import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BuildUpdateBanner } from '@/components/BuildUpdateBanner'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ReportsRedirect } from '@/components/routing/ReportsRedirect'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isDeleteCancelled } from '@/lib/api'
import { pushMutationError } from '@/lib/mutationErrorBus'
import { MutationErrorToasts } from '@/components/MutationErrorToasts'
import { warmLazyChunks } from '@/lib/warmChunks'
import './index.css'

// Suppress the dev-only "outdated JSX transform" warning from
// react-big-calendar — it's library-internal (their components call
// React.createElement directly), not our code, and there's nothing to
// fix on our side until they update. Strictly scoped to that one
// message; every other warning still flows through.
if (import.meta.env.DEV) {
  const origError = console.error
  console.error = (...args: unknown[]) => {
    const first = args[0]
    if (typeof first === 'string' && first.includes('outdated JSX transform')) return
    origError(...args)
  }
}
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import { DeleteConfirmProvider } from '@/components/DeleteConfirmProvider'
import { CompletionRequirementsProvider } from '@/components/CompletionRequirementsProvider'
import { SmsConsentProvider } from '@/components/SmsConsentProvider'
import { StepUpProvider } from '@/components/StepUpProvider'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import { HomeRoute } from '@/components/HomeRoute'

import { AppLayout } from '@/components/layout/AppLayout'

import { LoginPage } from '@/pages/LoginPage'
const AssetAccessLandingPage = lazy(() => import('@/pages/AssetAccessLandingPage').then((m) => ({ default: m.AssetAccessLandingPage })))
const DownloadPage = lazy(() => import('@/pages/DownloadPage').then((m) => ({ default: m.DownloadPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const PublicScanPage = lazy(() => import('@/pages/PublicScanPage').then((m) => ({ default: m.PublicScanPage })))
const PublicVerifyPage = lazy(() => import('@/pages/PublicVerifyPage').then((m) => ({ default: m.PublicVerifyPage })))
const PublicReportPage = lazy(() => import('@/pages/PublicReportPage').then((m) => ({ default: m.PublicReportPage })))
import { DashboardPage } from '@/pages/DashboardPage'
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const CustomerCreatePage = lazy(() => import('@/pages/CustomerCreatePage').then((m) => ({ default: m.CustomerCreatePage })))
const CustomerPartsRecordsPage = lazy(() => import('@/pages/CustomerPartsRecordsPage').then((m) => ({ default: m.CustomerPartsRecordsPage })))
const CustomerDetailPage = lazy(() => import('@/pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })))
const WorkOrdersPage = lazy(() => import('@/pages/WorkOrdersPage').then((m) => ({ default: m.WorkOrdersPage })))
const WorkOrderCreatePage = lazy(() => import('@/pages/WorkOrderCreatePage').then((m) => ({ default: m.WorkOrderCreatePage })))
const TasksPage = lazy(() => import('@/pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const WorkOrderDetailPage = lazy(() => import('@/pages/WorkOrderDetailPage').then((m) => ({ default: m.WorkOrderDetailPage })))
const SubReviewsPage = lazy(() => import('@/pages/SubReviewsPage').then((m) => ({ default: m.SubReviewsPage })))
const SubPayoutsPage = lazy(() => import('@/pages/SubPayoutsPage').then((m) => ({ default: m.SubPayoutsPage })))
const InboundSubJobsPage = lazy(() => import('@/pages/InboundSubJobsPage').then((m) => ({ default: m.InboundSubJobsPage })))
const AccountingPage = lazy(() => import('@/pages/AccountingPage').then((m) => ({ default: m.AccountingPage })))
const MoneyDeskPage = lazy(() => import('@/pages/MoneyDeskPage').then((m) => ({ default: m.MoneyDeskPage })))
const CashRegisterPage = lazy(() => import('@/pages/CashRegisterPage').then((m) => ({ default: m.CashRegisterPage })))
const BankMatchWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.BankMatchWorkspacePage })))
const CustomerCreditsWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.CustomerCreditsWorkspacePage })))
const ExpensesWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.ExpensesWorkspacePage })))
const InventoryCostWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.InventoryCostWorkspacePage })))
const PayrollWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.PayrollWorkspacePage })))
const CashDrawerPage = lazy(() => import('@/pages/CashDrawerPage').then((m) => ({ default: m.CashDrawerPage })))
const ExpenseRegisterPage = lazy(() => import('@/pages/ExpenseRegisterPage').then((m) => ({ default: m.ExpenseRegisterPage })))
const VendorBillsPage = lazy(() => import('@/pages/VendorBillsPage').then((m) => ({ default: m.VendorBillsPage })))
const BankMatchPage = lazy(() => import('@/pages/BankMatchPage').then((m) => ({ default: m.BankMatchPage })))
const ProcessorTransactionsPage = lazy(() => import('@/pages/ProcessorTransactionsPage').then((m) => ({ default: m.ProcessorTransactionsPage })))
const PayrollProfilesPage = lazy(() => import('@/pages/PayrollProfilesPage').then((m) => ({ default: m.PayrollProfilesPage })))
const GeneralLedgerPage = lazy(() => import('@/pages/GeneralLedgerPage').then((m) => ({ default: m.GeneralLedgerPage })))
const AccountingSyncMappingsPage = lazy(() => import('@/pages/AccountingSyncMappingsPage').then((m) => ({ default: m.AccountingSyncMappingsPage })))
const EstimatesPage = lazy(() => import('@/pages/EstimatesPage').then((m) => ({ default: m.EstimatesPage })))
const EstimateCreatePage = lazy(() => import('@/pages/EstimateCreatePage').then((m) => ({ default: m.EstimateCreatePage })))
const EstimateDetailPage = lazy(() => import('@/pages/EstimateDetailPage').then((m) => ({ default: m.EstimateDetailPage })))
const InvoiceDetailPage = lazy(() => import('@/pages/InvoiceDetailPage'))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const CommsPage = lazy(() => import('@/pages/CommsPage').then((m) => ({ default: m.CommsPage })))
const CallsPage = lazy(() => import('@/pages/CallsPage').then((m) => ({ default: m.CallsPage })))
const AiIntakeQueuePage = lazy(() => import('@/pages/AiIntakeQueuePage').then((m) => ({ default: m.AiIntakeQueuePage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const ReportQuestionsPage = lazy(() => import('@/pages/ReportQuestionsPage').then((m) => ({ default: m.ReportQuestionsPage })))
const FeedbackPortalPage = lazy(() => import('@/pages/FeedbackPortalPage').then((m) => ({ default: m.FeedbackPortalPage })))
const SalesTaxReportPage = lazy(() => import('@/pages/SalesTaxReportPage').then((m) => ({ default: m.SalesTaxReportPage })))
const SchedulePage = lazy(() => import('@/pages/SchedulePage').then((m) => ({ default: m.SchedulePage })))
const DispatchPage = lazy(() => import('@/pages/DispatchPage').then((m) => ({ default: m.DispatchPage })))
const RouteHistoryPage = lazy(() => import('@/pages/RouteHistoryPage').then((m) => ({ default: m.RouteHistoryPage })))
const FieldReviewPage = lazy(() => import('@/pages/FieldReviewPage').then((m) => ({ default: m.FieldReviewPage })))
const SettingsAppearancePage = lazy(() => import('@/pages/SettingsAppearancePage').then((m) => ({ default: m.SettingsAppearancePage })))
const FranchiseDashboardPage = lazy(() => import('@/pages/FranchiseDashboardPage').then((m) => ({ default: m.FranchiseDashboardPage })))
const MaintenanceContractsPage = lazy(() => import('@/pages/MaintenanceContractsPage'))
const NewServiceAgreementPage = lazy(() => import('@/pages/NewServiceAgreementPage').then((m) => ({ default: m.NewServiceAgreementPage })))
const MaintenanceContractDetailPage = lazy(() => import('@/pages/MaintenanceContractDetailPage'))
const MyAccountPage = lazy(() => import('@/pages/MyAccountPage').then((m) => ({ default: m.MyAccountPage })))
const KeyboardShortcutsPage = lazy(() => import('@/pages/KeyboardShortcutsPage').then((m) => ({ default: m.KeyboardShortcutsPage })))
const AiConnectorsPage = lazy(() => import('@/pages/AiConnectorsPage').then((m) => ({ default: m.AiConnectorsPage })))
const OauthAuthorizePage = lazy(() => import('@/pages/OauthAuthorizePage').then((m) => ({ default: m.OauthAuthorizePage })))
const CompanySecureFilesPage = lazy(() => import('@/pages/CompanySecureFilesPage').then((m) => ({ default: m.CompanySecureFilesPage })))
const SettingsLabelPrinterPage = lazy(() => import('@/pages/SettingsLabelPrinterPage').then((m) => ({ default: m.SettingsLabelPrinterPage })))
const BetaApplyPage = lazy(() => import('@/pages/BetaApplyPage').then((m) => ({ default: m.BetaApplyPage })))
const TimeOffPage = lazy(() => import('@/pages/TimeOffPage').then((m) => ({ default: m.TimeOffPage })))
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })))
const StaffOnboardingPage = lazy(() => import('@/pages/StaffOnboardingPage').then((m) => ({ default: m.StaffOnboardingPage })))
const SubOnboardingPage = lazy(() => import('@/pages/SubOnboardingPage').then((m) => ({ default: m.SubOnboardingPage })))
const TradeClaimPage = lazy(() => import('@/pages/TradeClaimPage').then((m) => ({ default: m.TradeClaimPage })))
const CompaniesIWorkForPage = lazy(() => import('@/pages/CompaniesIWorkForPage').then((m) => ({ default: m.CompaniesIWorkForPage })))
const SubDocumentsPage = lazy(() => import('@/pages/SubDocumentsPage').then((m) => ({ default: m.SubDocumentsPage })))
const SignDocumentPage = lazy(() => import('@/pages/SignDocumentPage').then((m) => ({ default: m.SignDocumentPage })))
const SignAgreementPage = lazy(() => import('@/pages/SignAgreementPage'))
import { RequirePermission } from '@/components/RequirePermission'
const WarrantiesPage = lazy(() => import('@/pages/WarrantiesPage').then((m) => ({ default: m.WarrantiesPage })))
const BoardApp = lazy(() => import('@/board/BoardApp').then((m) => ({ default: m.BoardApp })))
const InventoryPage = lazy(() => import('@/pages/InventoryPage').then((m) => ({ default: m.InventoryPage })))
const AssetsPage = lazy(() => import('@/pages/AssetsPage').then((m) => ({ default: m.AssetsPage })))
const PurchaseOrdersPage = lazy(() => import('@/pages/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })))
const NeedsOrderedPage = lazy(() => import('@/pages/NeedsOrderedPage').then((m) => ({ default: m.NeedsOrderedPage })))
const OrderPartsPage = lazy(() => import('@/pages/OrderPartsPage').then((m) => ({ default: m.OrderPartsPage })))
const InventoryMovementsPage = lazy(() => import('@/pages/InventoryMovementsPage').then((m) => ({ default: m.InventoryMovementsPage })))
const InventoryReconciliationsPage = lazy(() => import('@/pages/InventoryReconciliationsPage').then((m) => ({ default: m.InventoryReconciliationsPage })))
const InventoryUnitsPage = lazy(() => import('@/pages/InventoryUnitsPage').then((m) => ({ default: m.InventoryUnitsPage })))
const PurchaseOrderCreatePage = lazy(() => import('@/pages/PurchaseOrderCreatePage').then((m) => ({ default: m.PurchaseOrderCreatePage })))
const PurchaseOrderDetailPage = lazy(() => import('@/pages/PurchaseOrderDetailPage').then((m) => ({ default: m.PurchaseOrderDetailPage })))
const BlueprintTakeoffPage = lazy(() => import('@/pages/BlueprintTakeoffsPage').then((m) => ({ default: m.BlueprintTakeoffPage })))
const BlueprintTakeoffsPage = lazy(() => import('@/pages/BlueprintTakeoffsPage').then((m) => ({ default: m.BlueprintTakeoffsPage })))
const PurchaseOrderLabelsPage = lazy(() => import('@/pages/PurchaseOrderLabelsPage').then((m) => ({ default: m.PurchaseOrderLabelsPage })))
const PurchaseOrderSupplierCopyPage = lazy(() => import('@/pages/PurchaseOrderSupplierCopyPage').then((m) => ({ default: m.PurchaseOrderSupplierCopyPage })))
const BinLabelsPage = lazy(() => import('@/pages/BinLabelsPage').then((m) => ({ default: m.BinLabelsPage })))
const AssetLabelsPage = lazy(() => import('@/pages/AssetLabelsPage').then((m) => ({ default: m.AssetLabelsPage })))
const AssetBatchLabelsPage = lazy(() => import('@/pages/AssetBatchLabelsPage').then((m) => ({ default: m.AssetBatchLabelsPage })))
const AssetGroupLabelsPage = lazy(() => import('@/pages/AssetGroupLabelsPage').then((m) => ({ default: m.AssetGroupLabelsPage })))
const CatalogItemLabelsPage = lazy(() => import('@/pages/CatalogItemLabelsPage').then((m) => ({ default: m.CatalogItemLabelsPage })))
const InventoryReturnLabelsPage = lazy(() => import('@/pages/InventoryReturnLabelsPage').then((m) => ({ default: m.InventoryReturnLabelsPage })))
const QuickBooksCallbackPage = lazy(() => import('@/pages/QuickBooksCallbackPage').then((m) => ({ default: m.QuickBooksCallbackPage })))
const GoDaddyCallbackPage = lazy(() => import('@/pages/GoDaddyCallbackPage').then((m) => ({ default: m.GoDaddyCallbackPage })))
const CatalogsPage = lazy(() => import('@/pages/CatalogsPage').then((m) => ({ default: m.CatalogsPage })))

const isAssetAccessHost =
  typeof window !== 'undefined' && window.location.hostname === 'assets.crewbarn.com'

function ExternalAppRedirect({ origin }: { origin: string }) {
  window.location.replace(origin + window.location.pathname + window.location.search + window.location.hash)
  return null
}

const queryClient = new QueryClient({
  /**
   * Last-resort surface for writes that fail with nobody listening.
   *
   * Most useMutation blocks here declare no onError — usually fine, because a
   * hook's caller passes one or wraps mutateAsync in a try/catch. The rest fail
   * in silence: the button seems to do nothing and the only trace is a console
   * line. That shape produced several "it's not letting me save" reports.
   *
   * Only fires when the mutation's OWN options have no onError, so anything
   * declaring a handler in useMutation is left alone.
   *
   * It CANNOT see a handler passed at the call site — mutate(vars, {onError})
   * stores those on the observer, not on mutation.options — so those flows get
   * this banner as well as their own message. That duplication is the accepted
   * cost: showing a failure twice is a far smaller problem than the one being
   * fixed, which is showing it nowhere.
   */
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return
      // The delete-confirm modal rejects on cancel; that is a choice, not a
      // failure, and banners on it would be maddening.
      if (isDeleteCancelled(error)) return

      pushMutationError(
        error instanceof Error && error.message
          ? error.message
          : 'Something went wrong saving that. Please try again.',
      )
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

/**
 * crewbarn.tv gets the wall, and nothing else.
 *
 * Decided before the router, the auth provider and the layout, because
 * the board is none of those things: no sidebar, no signed-in account, no
 * navigation. A television is a screen the whole office reads, not a page
 * somebody uses, so it does not get the app wrapped around it.
 *
 * /tv on the ordinary host renders the same thing, so the board can be
 * worked on without a second machine and a real television.
 */
const BOARD_HOSTS = ['crewbarn.tv', 'www.crewbarn.tv']
const isBoard =
  BOARD_HOSTS.includes(window.location.hostname.toLowerCase()) ||
  window.location.pathname === '/tv' ||
  // /tv/preview/{id} is the same screen, drawn from a signed-in session
  // instead of a device token, so somebody can see what a television is
  // showing without standing in front of it.
  window.location.pathname.startsWith('/tv/preview/')

if (isBoard) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <BoardApp />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  )
} else {
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    {/* Outside the router and the auth provider on purpose: a tab running a
        retired build needs to be told so on every screen, signed in or not. */}
    <BuildUpdateBanner />
    {/* Outside the router too: a failed write must be visible on any screen. */}
    <MutationErrorToasts />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
          <DeleteConfirmProvider>
          <CompletionRequirementsProvider>
          <SmsConsentProvider>
          <StepUpProvider>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}>
          <Routes>
            {/* Public routes — no AppLayout */}
            <Route path="/login" element={isAssetAccessHost ? <AssetAccessLandingPage /> : <LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            {/* Public: "test the app with your crew" — invite requests. */}
            <Route path="/beta" element={<BetaApplyPage />} />
            {/* connect.crewbarn.com/download — the open-source work dashboard's
                front door. Public: deciding whether to self-host should not
                need an account. */}
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/scan/:code" element={<PublicScanPage />} />
            <Route path="/scan/:tenantId/:code" element={<PublicScanPage />} />
            {/* Public, no auth — an AHJ types a record number off paperwork. */}
            <Route path="/verify/:recordId" element={<PublicVerifyPage />} />
            {/* The report, public. Short path because it is read off
                paper and typed by hand. */}
            <Route path="/r/:tenantId/:reportNumber" element={<PublicReportPage />} />
            <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
            <Route path="/onboard/:token" element={<StaffOnboardingPage />} />
            {/* Public: a sub company sets up its free CrewBarn from an invite code. */}
            <Route path="/sub-onboarding" element={<SubOnboardingPage />} />
            {/* Public: a trade a customer brought in claims the free account set up for it. */}
            <Route path="/claim/:token" element={<TradeClaimPage />} />
            <Route path="/sign/:token" element={<SignDocumentPage />} />
            <Route path="/sign-agreement/:token" element={<SignAgreementPage />} />

            {/* Label print pages — auth-protected, but no AppLayout chrome
                (TopBar / nav / "Acting as" banner) so prints don't pull in
                the page header. They render full-screen so the toolbar +
                label grid are the only things on the page. */}
            <Route
              path="/assets/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="assets.view"><AssetLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="assets.view"><AssetBatchLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            {/* Building / area placard — the lobby QR that opens the whole
                site, which the API could mint but nothing could print. */}
            <Route
              path="/asset-groups/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="assets.view"><AssetGroupLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory-bins/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="inventory.view"><BinLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders/:id/supplier-copy"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="inventory.view"><PurchaseOrderSupplierCopyPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="inventory.view"><PurchaseOrderLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalog-items/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="catalog.view"><CatalogItemLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory-returns/:id/labels"
              element={
                <ProtectedRoute>
                  <RequirePermission permission="inventory.view"><InventoryReturnLabelsPage /></RequirePermission>
                </ProtectedRoute>
              }
            />

            {/* A sub company's onboarding screen 2 -- full screen, like the
                code page before it. Its owner lands here until every
                document it was asked for is in (SubDocumentsGate). */}
            <Route path="/sub-documents" element={<ProtectedRoute><SubDocumentsPage /></ProtectedRoute>} />

            {/* connect.crewbarn.com — the account console. Its own shell
                (a light rail, not the work nav), so these sit OUTSIDE
                AppLayout rather than inside it. */}
            {/* The website builder is full screen — no rail, no top bar — so it
                sits outside AppLayout like the Connect shell does. */}

            {/* Authenticated routes — share AppLayout (TopBar + SubNav) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={isAssetAccessHost ? <AssetAccessLandingPage /> : <HomeRoute><DashboardPage /></HomeRoute>} />

              {/* Work / Jobs */}
              <Route path="/jobs" element={<RequirePermission permission="jobs.view"><WorkOrdersPage /></RequirePermission>} />
              <Route path="/jobs/new" element={<RequirePermission permission="jobs.edit"><WorkOrderCreatePage /></RequirePermission>} />
              {/* /sub-jobs/new shortcut still works — just lands on the
                  unified create page with the Sub kind pre-selected. */}
              <Route path="/sub-jobs/new" element={<Navigate to="/jobs/new?kind=sub" replace />} />
              <Route path="/jobs/:id" element={<RequirePermission permission="jobs.view"><WorkOrderDetailPage /></RequirePermission>} />
              {/* Tasks — reachable by anyone who can see any task type; the
                  backend filters per-anchor (tasks / jobs+scope / customers). */}
              <Route path="/tasks" element={<RequirePermission permissions={["tasks.view", "jobs.view", "customers.view"]}><TasksPage /></RequirePermission>} />
              <Route path="/sub-reviews" element={<RequirePermission permission="jobs.view"><SubReviewsPage /></RequirePermission>} />
              <Route path="/sub-payouts" element={<RequirePermission permission="jobs.view"><SubPayoutsPage /></RequirePermission>} />
              <Route path="/inbound-sub-jobs" element={<RequirePermission permission="jobs.view"><InboundSubJobsPage /></RequirePermission>} />
              <Route path="/accounting" element={<RequirePermission permission="invoices.view"><MoneyDeskPage /></RequirePermission>} />
              {/* The charts-and-totals Overview this replaced. Kept — it's a
                  useful read, it just isn't what you open Accounting to do. */}
              <Route path="/accounting/overview" element={<RequirePermission permission="invoices.view"><AccountingPage /></RequirePermission>} />
              <Route path="/accounting/cash-drawer" element={<RequirePermission permission="invoices.view"><CashRegisterPage /></RequirePermission>} />
              {/* The original cash-drawer screen, kept — the register adds the
                  tech-till and uncollected views around it. */}
              <Route path="/accounting/cash-drawer/classic" element={<RequirePermission permission="invoices.view"><CashDrawerPage /></RequirePermission>} />
              <Route path="/accounting/customer-credits" element={<RequirePermission permission="invoices.view"><CustomerCreditsWorkspacePage /></RequirePermission>} />
              <Route path="/accounting/payroll" element={<RequirePermission permission="revenue.view"><PayrollWorkspacePage /></RequirePermission>} />
              <Route path="/accounting/payroll/profiles" element={<RequirePermission permission="staff.view"><PayrollProfilesPage /></RequirePermission>} />
              <Route path="/accounting/expenses" element={<RequirePermission permission="revenue.view"><ExpensesWorkspacePage /></RequirePermission>} />
              <Route path="/accounting/expenses/bills" element={<RequirePermission permission="revenue.view"><VendorBillsPage /></RequirePermission>} />
              <Route path="/accounting/expenses/register" element={<RequirePermission permission="revenue.view"><ExpenseRegisterPage /></RequirePermission>} />
              <Route path="/accounting/inventory-cost" element={<RequirePermission permission="inventory.view"><InventoryCostWorkspacePage /></RequirePermission>} />
              <Route path="/accounting/bank-match" element={<RequirePermission permission="revenue.view"><BankMatchWorkspacePage /></RequirePermission>} />
              <Route path="/accounting/card-processor" element={<RequirePermission permission="invoices.view"><ProcessorTransactionsPage /></RequirePermission>} />
              <Route path="/accounting/bank-match/review" element={<RequirePermission permission="revenue.view"><BankMatchPage /></RequirePermission>} />
              <Route path="/accounting/ledger" element={<RequirePermission permission="revenue.view"><GeneralLedgerPage /></RequirePermission>} />
              <Route path="/accounting/sync-mappings" element={<RequirePermission permission="revenue.view"><AccountingSyncMappingsPage /></RequirePermission>} />
              {/* Legacy /money paths → /accounting (kept for old bookmarks). */}
              <Route path="/money/pending" element={<Navigate to="/accounting" replace />} />

              {/* Customers */}
              <Route path="/customers" element={<RequirePermission permission="customers.view"><CustomersPage /></RequirePermission>} />
              <Route path="/customers/search" element={<RequirePermission permission="customers.view"><CustomersPage /></RequirePermission>} />
              <Route path="/customers/new" element={<RequirePermission permission="customers.edit"><CustomerCreatePage /></RequirePermission>} />
              <Route path="/customers/:id/records" element={<RequirePermission permission="customers.view"><CustomerPartsRecordsPage /></RequirePermission>} />
              <Route path="/customers/:id" element={<RequirePermission permission="customers.view"><CustomerDetailPage /></RequirePermission>} />

              {/* Coming-soon primary nav placeholders */}
              <Route path="/communications" element={<RequirePermission permission="customers.view"><CommsPage /></RequirePermission>} />
              <Route path="/calls" element={<RequirePermission permission="calls.view"><CallsPage /></RequirePermission>} />
              <Route path="/intake" element={<RequirePermission permission="customers.view"><AiIntakeQueuePage /></RequirePermission>} />
              <Route path="/schedule" element={<RequirePermission permission="jobs.view"><SchedulePage /></RequirePermission>} />
              <Route path="/dispatch" element={<RequirePermission permission="jobs.view"><DispatchPage /></RequirePermission>} />
              <Route path="/dispatch/field-review" element={<RequirePermission permission="jobs.view"><FieldReviewPage /></RequirePermission>} />
              <Route path="/dispatch/route-history" element={<RequirePermission permission="jobs.view"><RouteHistoryPage /></RequirePermission>} />
              <Route path="/franchises" element={<RequirePermission permission="franchises.view"><FranchiseDashboardPage /></RequirePermission>} />
              <Route path="/money" element={<Navigate to="/accounting" replace />} />

              {/* Estimates - top-level routes */}
              <Route path="/estimates" element={<RequirePermission permission="jobs.view"><EstimatesPage /></RequirePermission>} />
              <Route path="/estimates/new" element={<RequirePermission permission="jobs.edit"><EstimateCreatePage /></RequirePermission>} />
              <Route path="/estimates/:id" element={<RequirePermission permission="jobs.view"><EstimateDetailPage /></RequirePermission>} />
              {/* Invoices — list lives under Accounting; detail stays at /invoices/:id */}
              <Route path="/accounting/invoices" element={<RequirePermission permission="invoices.view"><InvoicesPage /></RequirePermission>} />
              <Route path="/invoices" element={<Navigate to="/accounting/invoices" replace />} />
              <Route path="/invoices/:id" element={<RequirePermission permission="invoices.view"><InvoiceDetailPage /></RequirePermission>} />
              <Route path="/accounting/reports" element={<RequirePermission permission="revenue.view"><ReportQuestionsPage /></RequirePermission>} />
              {/* The workspace itself. The front door sends people here, and
                  any old /accounting/reports?report=... bookmark is forwarded
                  by ReportQuestionsPage rather than silently losing its report. */}
              <Route path="/accounting/reports/browse" element={<RequirePermission permission="revenue.view"><ReportsPage /></RequirePermission>} />
              {/* Kept, not dropped: bookmarks, emailed links, and anything
                  that already points at /reports must keep working. */}
              <Route path="/reports" element={<ReportsRedirect />} />
              {/* Bugs & Ideas — open to every signed-in member, no permission gate. */}
              <Route path="/feedback" element={<FeedbackPortalPage />} />
              {/* Sales tax report lives under Accounting; old path redirects. */}
              <Route path="/accounting/sales-tax" element={<RequirePermission permission="revenue.view"><SalesTaxReportPage /></RequirePermission>} />
              <Route path="/reports/sales-tax" element={<Navigate to="/accounting/sales-tax" replace />} />

              {/* Tool Shed — single wildcard handles all placeholder items */}
              {/* Real Tool Shed pages — must come BEFORE the wildcard
                  /tool-shed/:slug below, otherwise the placeholder catches them. */}
              {/* Google sends the browser here after the shop grants access.
                  The path is registered in the Google console, so it is part of
                  the integration rather than a detail. */}
              {/* Personal account security (2FA) — per-USER login setting.
                  Account-scoped path (/me/*), reached from the account menu. */}
              <Route path="/me/account" element={<MyAccountPage />} />
              <Route path="/me/keyboard-shortcuts" element={<KeyboardShortcutsPage />} />
              <Route path="/me/ai-connectors" element={<RequirePermission permission="settings.edit"><AiConnectorsPage /></RequirePermission>} />
              <Route path="/oauth/authorize" element={<OauthAuthorizePage />} />
              {/* Tenant Security & 2FA — personal enrollment (real tenant users)
                  + tenant 2FA policy. Reached from the Tool Shed. */}
              <Route path="/tool-shed/company-files" element={<RequirePermission permission="company.secure_files.list"><CompanySecureFilesPage /></RequirePermission>} />
              {/* Static docs, but Tool Shed is sign-in only — and it belongs inside the app chrome. */}

              <Route path="/my-time-off" element={<TimeOffPage />} />
              {/* Where the Print Bridge's own window tells people to go. */}
              <Route path="/tool-shed/label-printer" element={<RequirePermission permission="settings.view"><SettingsLabelPrinterPage /></RequirePermission>} />
              <Route path="/tool-shed/appearance" element={<SettingsAppearancePage />} />

              {/* One setting per page (docs/design/connect/README.md). These
                  sit ALONGSIDE the pages above, not instead of them: the long
                  pages also hold connection cards and other settings, and
                  removing those to make room would take away working
                  features. Settings move across one at a time. */}

              {/* Inventory, catalog, and legacy settings redirects. Visible settings
                  pages now live under Tool Shed; old /settings/* URLs are kept
                  for bookmarks and older in-app links. */}
              <Route path="/inventory" element={<RequirePermission permission="inventory.view"><InventoryPage /></RequirePermission>} />
              <Route path="/inventory/movements" element={<RequirePermission permission="inventory.view"><InventoryMovementsPage /></RequirePermission>} />
              <Route path="/inventory/reconciliations" element={<RequirePermission permission="inventory.view"><InventoryReconciliationsPage /></RequirePermission>} />
              <Route path="/inventory/units" element={<RequirePermission permission="inventory.view"><InventoryUnitsPage /></RequirePermission>} />
              <Route path="/assets" element={<RequirePermission permission="assets.view"><AssetsPage /></RequirePermission>} />
              <Route path="/purchase-orders" element={<RequirePermission permission="inventory.view"><PurchaseOrdersPage /></RequirePermission>} />
              <Route path="/purchase-orders/needs-ordered" element={<RequirePermission permission="inventory.view"><NeedsOrderedPage /></RequirePermission>} />
              <Route path="/order-parts" element={<RequirePermission permissions={['inventory.order', 'inventory.edit', 'jobs.edit']}><OrderPartsPage /></RequirePermission>} />
              <Route path="/purchase-orders/new" element={<RequirePermission permission="inventory.edit"><PurchaseOrderCreatePage /></RequirePermission>} />
              <Route path="/purchase-orders/blueprints" element={<RequirePermission permissions={['inventory.view', 'jobs.edit']}><BlueprintTakeoffsPage /></RequirePermission>} />
              <Route path="/purchase-orders/blueprints/:id" element={<RequirePermission permissions={['inventory.view', 'jobs.edit']}><BlueprintTakeoffPage /></RequirePermission>} />
              <Route path="/purchase-orders/:id" element={<RequirePermission permission="inventory.view"><PurchaseOrderDetailPage /></RequirePermission>} />
              {/* /assets/:id/labels, /inventory-bins/:id/labels, and
                  /purchase-orders/:id/labels are mounted ABOVE this
                  block so they bypass AppLayout (no chrome in print). */}
              {/* Two segments, so it cannot be mistaken for the editor's
                  /custom-documents/:tab/:id. */}
              <Route path="/maintenance-contracts" element={<RequirePermission permission="contracts.view"><MaintenanceContractsPage /></RequirePermission>} />
              {/* Before /:id, or "new" is read as a contract id. */}
              <Route path="/maintenance-contracts/new" element={<RequirePermission permission="contracts.edit"><NewServiceAgreementPage /></RequirePermission>} />
              <Route path="/maintenance-contracts/:id" element={<RequirePermission permission="contracts.view"><MaintenanceContractDetailPage /></RequirePermission>} />
              <Route path="/companies-i-work-for" element={<RequirePermission permission="staff.view"><CompaniesIWorkForPage /></RequirePermission>} />
              {/* Legacy /email-templates redirects into the Email tab of Custom Documents. */}
              <Route path="/email-templates" element={<Navigate to="/custom-documents" replace />} />
              <Route path="/warranties" element={<RequirePermission permission="warranties.view"><WarrantiesPage /></RequirePermission>} />
              <Route path="/oauth/quickbooks" element={<RequirePermission permission="settings.view"><QuickBooksCallbackPage /></RequirePermission>} />
              <Route path="/oauth/godaddy" element={<RequirePermission permission="settings.edit"><GoDaddyCallbackPage /></RequirePermission>} />
              <Route path="/catalogs" element={<RequirePermission permission="catalog.view"><CatalogsPage /></RequirePermission>} />
            </Route>

              <Route path="/sign-up" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/verify-signup" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/connect" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/connect/:section" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/website-builder" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/subcontractors" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/franchise-support" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/territories" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/custom-fields" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/job-statuses" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/job-types" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/task-groups" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/brand" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/website" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/google-reviews" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/google-reviews/connected" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payments" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/cloudflare" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/customer-app" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/subscription" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/self-hosted" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/audit-log" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/service-locations" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/tags" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/company-info" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payment-types" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/me/security" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/security" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/delete-permissions" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/encryption" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/automations" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/automations/build" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/automations/build/:id" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/automations/reminders" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/customer-types" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/integrations" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/api-tokens" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/api-endpoints" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/usage" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/time-off" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/responsibilities" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/employee-settings" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/call-scripts" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/data-export" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/gps" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/marketplace" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/partner-connections" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/shop-tv" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/webhooks" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/pricing" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/cost-model" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/connected-apps" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/modules" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/inventory-settings" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/communication" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/communication/transcription" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/storage-maps" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/warranty-settings" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/provider" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/key" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/allowed" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/learning" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/memory" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/voice" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai/activity" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/settings-location" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payments/card-processor" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payments/bank-transfer" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payments/watch-bank" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/communication/email" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/warranty-settings/expiring" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/communication/twilio" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/communication/twilio/setup" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/reminders" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/cash-collection" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/contract-invoices" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/stalled-jobs" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/video-length" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/auto-check-in" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/preferences/late-techs" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/service-agreements" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/ai" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/onboarding" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/:slug" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/company-assets" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/asset-access-requests" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/asset-types" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/vendors" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/inventory" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/communication" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/integrations" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/warranty" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/settings/ai" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/custom-documents" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/custom-documents/new-form" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/custom-documents/:tab/:id" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/roles" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/staff" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/hiring" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/tax-classes" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/payment-terms" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/tool-shed/import" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/services" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/products" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/products/:id" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/categories" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/reference-cards" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />
              <Route path="/catalog/product-categories" element={<ExternalAppRedirect origin="https://connect.crewbarn.com" />} />

            {/* Catch-all: redirect unmatched routes to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </StepUpProvider>
          </SmsConsentProvider>
          </CompletionRequirementsProvider>
          </DeleteConfirmProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
// Once the first screen is up, fetch the rest in the background.
warmLazyChunks()
}
