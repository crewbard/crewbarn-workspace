import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BuildUpdateBanner } from '@/components/BuildUpdateBanner'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isDeleteCancelled } from '@/lib/api'
import { pushMutationError } from '@/lib/mutationErrorBus'
import { MutationErrorToasts } from '@/components/MutationErrorToasts'
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
import { StepUpProvider } from '@/components/StepUpProvider'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomeRoute } from '@/components/HomeRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { AssetAccessLandingPage } from '@/pages/AssetAccessLandingPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { PublicScanPage } from '@/pages/PublicScanPage'
import { PublicVerifyPage } from '@/pages/PublicVerifyPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { CustomerCreatePage } from '@/pages/CustomerCreatePage'
import { CustomerDetailPage } from '@/pages/CustomerDetailPage'
import { WorkOrdersPage } from '@/pages/WorkOrdersPage'
import { WorkOrderCreatePage } from '@/pages/WorkOrderCreatePage'
import { TasksPage } from '@/pages/TasksPage'
import { WorkOrderDetailPage } from '@/pages/WorkOrderDetailPage'
import { SubReviewsPage } from '@/pages/SubReviewsPage'
import { SubPayoutsPage } from '@/pages/SubPayoutsPage'
import { SubcontractorsPage } from '@/pages/SubcontractorsPage'
import { InboundSubJobsPage } from '@/pages/InboundSubJobsPage'
const AccountingPage = lazy(() => import('@/pages/AccountingPage').then((m) => ({ default: m.AccountingPage })))
import { MoneyDeskPage } from '@/pages/MoneyDeskPage'
import { CashRegisterPage } from '@/pages/CashRegisterPage'
import {
  BankMatchWorkspacePage,
  CustomerCreditsWorkspacePage,
  ExpensesWorkspacePage,
  InventoryCostWorkspacePage,
  PayrollWorkspacePage,
} from '@/pages/AccountingWorkspacePages'
import { CashDrawerPage } from '@/pages/CashDrawerPage'
import { ExpenseRegisterPage } from '@/pages/ExpenseRegisterPage'
import { VendorBillsPage } from '@/pages/VendorBillsPage'
import { BankMatchPage } from '@/pages/BankMatchPage'
import { ProcessorTransactionsPage } from '@/pages/ProcessorTransactionsPage'
import { PayrollProfilesPage } from '@/pages/PayrollProfilesPage'
const GeneralLedgerPage = lazy(() => import('@/pages/GeneralLedgerPage').then((m) => ({ default: m.GeneralLedgerPage })))
const AccountingSyncMappingsPage = lazy(() => import('@/pages/AccountingSyncMappingsPage').then((m) => ({ default: m.AccountingSyncMappingsPage })))
import { EstimatesPage } from '@/pages/EstimatesPage'
import { EstimateCreatePage } from '@/pages/EstimateCreatePage'
import { EstimateDetailPage } from '@/pages/EstimateDetailPage'
import InvoiceDetailPage from '@/pages/InvoiceDetailPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { CommsPage } from '@/pages/CommsPage'
import { CallsPage } from '@/pages/CallsPage'
import { AiIntakeQueuePage } from '@/pages/AiIntakeQueuePage'
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
import { ReportQuestionsPage } from '@/pages/ReportQuestionsPage'
import { FeedbackPortalPage } from '@/pages/FeedbackPortalPage'
const SalesTaxReportPage = lazy(() => import('@/pages/SalesTaxReportPage').then((m) => ({ default: m.SalesTaxReportPage })))
import { SchedulePage } from '@/pages/SchedulePage'
import { DispatchPage } from '@/pages/DispatchPage'
import { RouteHistoryPage } from '@/pages/RouteHistoryPage'
import { FieldReviewPage } from '@/pages/FieldReviewPage'
const ToolShedPage = lazy(() => import('@/pages/ToolShedPage').then((m) => ({ default: m.ToolShedPage })))
const ToolShedPlaceholderPage = lazy(() => import('@/pages/ToolShedPlaceholderPage').then((m) => ({ default: m.ToolShedPlaceholderPage })))
const SettingsWarrantyPage = lazy(() => import('@/pages/SettingsWarrantyPage').then((m) => ({ default: m.SettingsWarrantyPage })))
const SettingsAppearancePage = lazy(() => import('@/pages/SettingsAppearancePage').then((m) => ({ default: m.SettingsAppearancePage })))
const SettingsModulesPage = lazy(() => import('@/pages/SettingsModulesPage').then((m) => ({ default: m.SettingsModulesPage })))
import { FranchiseDashboardPage } from '@/pages/FranchiseDashboardPage'
import { FranchiseSupportPage } from '@/pages/FranchiseSupportPage'
import { TerritoriesPage } from '@/pages/TerritoriesPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { CustomDocumentsPage } from '@/pages/CustomDocumentsPage'
import TemplateEditorPage from '@/pages/TemplateEditorPage'
import { CustomFieldsPage } from '@/pages/CustomFieldsPage'
import { HiringPage } from '@/pages/HiringPage'
import { JobStatusesPage } from '@/pages/JobStatusesPage'
import { JobTypesPage } from '@/pages/JobTypesPage'
const SettingsBrandPage = lazy(() => import('@/pages/SettingsBrandPage').then((m) => ({ default: m.SettingsBrandPage })))
const SettingsWebhooksPage = lazy(() => import('@/pages/SettingsWebhooksPage').then((m) => ({ default: m.SettingsWebhooksPage })))
const SettingsPricingPage = lazy(() => import('@/pages/SettingsPricingPage').then((m) => ({ default: m.SettingsPricingPage })))
import { CompanyCostModelPage } from '@/pages/CompanyCostModelPage'
import { ConnectedAppsPage } from '@/pages/ConnectedAppsPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { ServiceLocationsPage } from '@/pages/ServiceLocationsPage'
import { TagsPage } from '@/pages/TagsPage'
const SettingsCompanyPage = lazy(() => import('@/pages/SettingsCompanyPage').then((m) => ({ default: m.SettingsCompanyPage })))
const SettingsPaymentTypesPage = lazy(() => import('@/pages/SettingsPaymentTypesPage').then((m) => ({ default: m.SettingsPaymentTypesPage })))
import { MyAccountPage } from '@/pages/MyAccountPage'
import { AiConnectorsPage } from '@/pages/AiConnectorsPage'
import { OauthAuthorizePage } from '@/pages/OauthAuthorizePage'
import { DeletePermissionsPage } from '@/pages/DeletePermissionsPage'
import { CompanySecureFilesPage } from '@/pages/CompanySecureFilesPage'
const SettingsPreferencesPage = lazy(() => import('@/pages/SettingsPreferencesPage').then((m) => ({ default: m.SettingsPreferencesPage })))
import { AutomationsHubPage } from '@/pages/AutomationsHubPage'
import { CustomerTypesPage } from '@/pages/CustomerTypesPage'
import { IntegrationsOverviewPage } from '@/pages/IntegrationsOverviewPage'
import { ApiTokensPage } from '@/pages/ApiTokensPage'
import { ApiEndpointsPage } from '@/pages/ApiEndpointsPage'
import { BetaApplyPage } from '@/pages/BetaApplyPage'
import { UsageStatsPage } from '@/pages/UsageStatsPage'
import { TimeOffPage } from '@/pages/TimeOffPage'
import { DataExportPage } from '@/pages/DataExportPage'
import { RolesPermissionsPage } from '@/pages/RolesPermissionsPage'
import { StaffCrewsPage } from '@/pages/StaffCrewsPage'
import { AcceptInvitePage } from '@/pages/AcceptInvitePage'
import { SignDocumentPage } from '@/pages/SignDocumentPage'
import SignAgreementPage from '@/pages/SignAgreementPage'
import { RequirePermission } from '@/components/RequirePermission'
import { WarrantiesPage } from '@/pages/WarrantiesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { AssetsPage } from '@/pages/AssetsPage'
import { AssetAccessRequestsPage } from '@/pages/AssetAccessRequestsPage'
import { CompanyAssetsPage } from '@/pages/CompanyAssetsPage'
import { AssetTypesPage } from '@/pages/AssetTypesPage'
import { VendorsPage } from '@/pages/VendorsPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { NeedsOrderedPage } from '@/pages/NeedsOrderedPage'
import { InventoryMovementsPage } from '@/pages/InventoryMovementsPage'
import { InventoryReconciliationsPage } from '@/pages/InventoryReconciliationsPage'
import { InventoryUnitsPage } from '@/pages/InventoryUnitsPage'
import { PurchaseOrderCreatePage } from '@/pages/PurchaseOrderCreatePage'
import { PurchaseOrderDetailPage } from '@/pages/PurchaseOrderDetailPage'
import { PurchaseOrderLabelsPage } from '@/pages/PurchaseOrderLabelsPage'
import { BinLabelsPage } from '@/pages/BinLabelsPage'
import { AssetLabelsPage } from '@/pages/AssetLabelsPage'
import { AssetBatchLabelsPage } from '@/pages/AssetBatchLabelsPage'
import { AssetGroupLabelsPage } from '@/pages/AssetGroupLabelsPage'
import { CatalogItemLabelsPage } from '@/pages/CatalogItemLabelsPage'
import { InventoryReturnLabelsPage } from '@/pages/InventoryReturnLabelsPage'
import { TaxClassesPage } from '@/pages/TaxClassesPage'
import { PaymentTermsPage } from '@/pages/PaymentTermsPage'
import { ImportWizardPage } from '@/pages/ImportWizardPage'
import { QuickBooksCallbackPage } from '@/pages/QuickBooksCallbackPage'
import { GoDaddyCallbackPage } from '@/pages/GoDaddyCallbackPage'
import { ServiceCatalogPage } from '@/pages/ServiceCatalogPage'
import { ProductCatalogPage } from '@/pages/ProductCatalogPage'
import { CatalogCategoriesPage } from '@/pages/CatalogCategoriesPage'
import { ProductCategoriesPage } from '@/pages/ProductCategoriesPage'

const isAssetAccessHost =
  typeof window !== 'undefined' && window.location.hostname === 'assets.crewbarn.com'

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
          <StepUpProvider>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500" role="status">Loading…</div>}>
          <Routes>
            {/* Public routes — no AppLayout */}
            <Route path="/login" element={isAssetAccessHost ? <AssetAccessLandingPage /> : <LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            {/* Public: "test the app with your crew" — invite requests. */}
            <Route path="/beta" element={<BetaApplyPage />} />
            <Route path="/scan/:code" element={<PublicScanPage />} />
            <Route path="/scan/:tenantId/:code" element={<PublicScanPage />} />
            {/* Public, no auth — an AHJ types a record number off paperwork. */}
            <Route path="/verify/:recordId" element={<PublicVerifyPage />} />
            <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
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
                  <AssetLabelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets/labels"
              element={
                <ProtectedRoute>
                  <AssetBatchLabelsPage />
                </ProtectedRoute>
              }
            />
            {/* Building / area placard — the lobby QR that opens the whole
                site, which the API could mint but nothing could print. */}
            <Route
              path="/asset-groups/:id/labels"
              element={
                <ProtectedRoute>
                  <AssetGroupLabelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory-bins/:id/labels"
              element={
                <ProtectedRoute>
                  <BinLabelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders/:id/labels"
              element={
                <ProtectedRoute>
                  <PurchaseOrderLabelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalog-items/:id/labels"
              element={
                <ProtectedRoute>
                  <CatalogItemLabelsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory-returns/:id/labels"
              element={
                <ProtectedRoute>
                  <InventoryReturnLabelsPage />
                </ProtectedRoute>
              }
            />

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
              <Route path="/tool-shed/subcontractors" element={<RequirePermission permission="jobs.view"><SubcontractorsPage /></RequirePermission>} />

              {/* Customers */}
              <Route path="/customers" element={<RequirePermission permission="customers.view"><CustomersPage /></RequirePermission>} />
              <Route path="/customers/search" element={<RequirePermission permission="customers.view"><CustomersPage /></RequirePermission>} />
              <Route path="/customers/new" element={<RequirePermission permission="customers.edit"><CustomerCreatePage /></RequirePermission>} />
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
              <Route path="/franchise-support" element={<RequirePermission permission="settings.view"><FranchiseSupportPage /></RequirePermission>} />
              <Route path="/tool-shed/territories" element={<RequirePermission permission="settings.view"><TerritoriesPage /></RequirePermission>} />
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
              <Route path="/reports" element={<Navigate to="/accounting/reports" replace />} />
              {/* Bugs & Ideas — open to every signed-in member, no permission gate. */}
              <Route path="/feedback" element={<FeedbackPortalPage />} />
              {/* Sales tax report lives under Accounting; old path redirects. */}
              <Route path="/accounting/sales-tax" element={<SalesTaxReportPage />} />
              <Route path="/reports/sales-tax" element={<Navigate to="/accounting/sales-tax" replace />} />

              {/* Tool Shed — single wildcard handles all placeholder items */}
              {/* Real Tool Shed pages — must come BEFORE the wildcard
                  /tool-shed/:slug below, otherwise the placeholder catches them. */}
              <Route path="/tool-shed" element={<RequirePermission permission="settings.view"><ToolShedPage /></RequirePermission>} />
              <Route path="/tool-shed/custom-fields" element={<RequirePermission permission="settings.view"><CustomFieldsPage /></RequirePermission>} />
              <Route path="/tool-shed/job-statuses" element={<RequirePermission permission="settings.view"><JobStatusesPage /></RequirePermission>} />
              <Route path="/tool-shed/job-types" element={<RequirePermission permission="settings.view"><JobTypesPage /></RequirePermission>} />
              <Route path="/tool-shed/brand" element={<RequirePermission permission="settings.edit"><SettingsBrandPage /></RequirePermission>} />
              <Route path="/tool-shed/audit-log" element={<RequirePermission permission="settings.view"><AuditLogPage /></RequirePermission>} />
              <Route path="/tool-shed/service-locations" element={<RequirePermission permission="customers.view"><ServiceLocationsPage /></RequirePermission>} />
              <Route path="/tool-shed/tags" element={<RequirePermission permission="settings.view"><TagsPage /></RequirePermission>} />
              <Route path="/tool-shed/company-info" element={<RequirePermission permission="settings.view"><SettingsCompanyPage /></RequirePermission>} />
              <Route path="/tool-shed/payment-types" element={<RequirePermission permission="settings.view"><SettingsPaymentTypesPage /></RequirePermission>} />
              {/* Personal account security (2FA) — per-USER login setting.
                  Account-scoped path (/me/*), reached from the account menu. */}
              <Route path="/me/account" element={<MyAccountPage />} />
              <Route path="/me/ai-connectors" element={<RequirePermission permission="settings.edit"><AiConnectorsPage /></RequirePermission>} />
              <Route path="/oauth/authorize" element={<OauthAuthorizePage />} />
              {/* Tenant Security & 2FA — personal enrollment (real tenant users)
                  + tenant 2FA policy. Reached from the Tool Shed. */}
              <Route path="/tool-shed/delete-permissions" element={<DeletePermissionsPage />} />
              <Route path="/tool-shed/company-files" element={<RequirePermission permission="company.secure_files.list"><CompanySecureFilesPage /></RequirePermission>} />
              <Route path="/tool-shed/preferences" element={<RequirePermission permission="settings.view"><SettingsPreferencesPage /></RequirePermission>} />
              <Route path="/tool-shed/automations" element={<RequirePermission permission="settings.view"><AutomationsHubPage /></RequirePermission>} />
              <Route path="/tool-shed/customer-types" element={<RequirePermission permission="customers.view"><CustomerTypesPage /></RequirePermission>} />
              <Route path="/tool-shed/integrations" element={<RequirePermission permission="settings.view"><IntegrationsOverviewPage /></RequirePermission>} />
              <Route path="/tool-shed/api-tokens" element={<RequirePermission permission="settings.edit"><ApiTokensPage /></RequirePermission>} />
              {/* Static docs, but Tool Shed is sign-in only — and it belongs inside the app chrome. */}
              <Route path="/tool-shed/api-endpoints" element={<RequirePermission permission="settings.view"><ApiEndpointsPage /></RequirePermission>} />

              <Route path="/tool-shed/usage" element={<RequirePermission permission="settings.view"><UsageStatsPage /></RequirePermission>} />
              <Route path="/tool-shed/time-off" element={<TimeOffPage />} />
              <Route path="/my-time-off" element={<TimeOffPage />} />
              <Route path="/tool-shed/data-export" element={<RequirePermission permission="settings.edit"><DataExportPage /></RequirePermission>} />
              <Route path="/tool-shed/webhooks" element={<RequirePermission permission="settings.edit"><SettingsWebhooksPage /></RequirePermission>} />
              <Route path="/tool-shed/pricing" element={<RequirePermission permission="catalog.view"><SettingsPricingPage /></RequirePermission>} />
              <Route path="/tool-shed/cost-model" element={<RequirePermission permission="revenue.view"><CompanyCostModelPage /></RequirePermission>} />
              <Route path="/tool-shed/connected-apps" element={<RequirePermission permission="settings.view"><ConnectedAppsPage /></RequirePermission>} />
              <Route path="/tool-shed/appearance" element={<RequirePermission permission="settings.view"><SettingsAppearancePage /></RequirePermission>} />
              <Route path="/tool-shed/modules" element={<RequirePermission permission="settings.edit"><SettingsModulesPage /></RequirePermission>} />
              <Route path="/tool-shed/inventory-settings" element={<Navigate to="/inventory?tab=settings" replace />} />
              <Route path="/tool-shed/warranty-settings" element={<RequirePermission permission="settings.view"><SettingsWarrantyPage /></RequirePermission>} />
              <Route path="/onboarding" element={<RequirePermission permission="settings.view"><OnboardingPage /></RequirePermission>} />
              <Route path="/tool-shed/:slug" element={<ToolShedPlaceholderPage />} />

              {/* Inventory, catalog, and legacy settings redirects. Visible settings
                  pages now live under Tool Shed; old /settings/* URLs are kept
                  for bookmarks and older in-app links. */}
              <Route path="/inventory" element={<RequirePermission permission="inventory.view"><InventoryPage /></RequirePermission>} />
              <Route path="/inventory/movements" element={<RequirePermission permission="inventory.view"><InventoryMovementsPage /></RequirePermission>} />
              <Route path="/inventory/reconciliations" element={<RequirePermission permission="inventory.view"><InventoryReconciliationsPage /></RequirePermission>} />
              <Route path="/inventory/units" element={<RequirePermission permission="inventory.view"><InventoryUnitsPage /></RequirePermission>} />
              <Route path="/company-assets" element={<RequirePermission permission="assets.view"><CompanyAssetsPage /></RequirePermission>} />
              <Route path="/assets" element={<RequirePermission permission="assets.view"><AssetsPage /></RequirePermission>} />
              <Route path="/asset-access-requests" element={<RequirePermission permission="assets.view"><AssetAccessRequestsPage /></RequirePermission>} />
              <Route path="/asset-types" element={<RequirePermission permission="assets.view"><AssetTypesPage /></RequirePermission>} />
              <Route path="/vendors" element={<RequirePermission permission="inventory.view"><VendorsPage /></RequirePermission>} />
              <Route path="/purchase-orders" element={<RequirePermission permission="inventory.view"><PurchaseOrdersPage /></RequirePermission>} />
              <Route path="/purchase-orders/needs-ordered" element={<RequirePermission permission="inventory.view"><NeedsOrderedPage /></RequirePermission>} />
              <Route path="/purchase-orders/new" element={<RequirePermission permission="inventory.edit"><PurchaseOrderCreatePage /></RequirePermission>} />
              <Route path="/purchase-orders/:id" element={<RequirePermission permission="inventory.view"><PurchaseOrderDetailPage /></RequirePermission>} />
              {/* /assets/:id/labels, /inventory-bins/:id/labels, and
                  /purchase-orders/:id/labels are mounted ABOVE this
                  block so they bypass AppLayout (no chrome in print). */}
              <Route path="/settings/inventory" element={<Navigate to="/inventory?tab=settings" replace />} />
              <Route path="/settings/communication" element={<Navigate to="/tool-shed/communication" replace />} />
              <Route path="/settings/integrations" element={<Navigate to="/tool-shed/storage-maps" replace />} />
              <Route path="/settings/warranty" element={<Navigate to="/tool-shed/warranty-settings" replace />} />
              <Route path="/settings/ai" element={<Navigate to="/tool-shed/ai" replace />} />
              <Route path="/custom-documents" element={<RequirePermission permission="templates.view"><CustomDocumentsPage /></RequirePermission>} />
              <Route path="/custom-documents/:tab/:id" element={<RequirePermission permission="templates.view"><TemplateEditorPage /></RequirePermission>} />
              <Route path="/tool-shed/roles" element={<RequirePermission permission="staff.view"><RolesPermissionsPage /></RequirePermission>} />
              <Route path="/tool-shed/staff" element={<RequirePermission permission="staff.view"><StaffCrewsPage /></RequirePermission>} />
              <Route path="/tool-shed/hiring" element={<RequirePermission permission="staff.view"><HiringPage /></RequirePermission>} />
              {/* Legacy /email-templates redirects into the Email tab of Custom Documents. */}
              <Route path="/email-templates" element={<Navigate to="/custom-documents" replace />} />
              <Route path="/warranties" element={<RequirePermission permission="warranties.view"><WarrantiesPage /></RequirePermission>} />
              <Route path="/catalog/tax-classes" element={<RequirePermission permission="catalog.view"><TaxClassesPage /></RequirePermission>} />
              <Route path="/tool-shed/payment-terms" element={<RequirePermission permission="invoices.view"><PaymentTermsPage /></RequirePermission>} />
              <Route path="/tool-shed/import" element={<RequirePermission permission="settings.view"><ImportWizardPage /></RequirePermission>} />
              <Route path="/oauth/quickbooks" element={<RequirePermission permission="settings.view"><QuickBooksCallbackPage /></RequirePermission>} />
              <Route path="/oauth/godaddy" element={<RequirePermission permission="settings.edit"><GoDaddyCallbackPage /></RequirePermission>} />
              <Route path="/catalog/services" element={<RequirePermission permission="catalog.view"><ServiceCatalogPage /></RequirePermission>} />
              <Route path="/catalog/products" element={<RequirePermission permission="catalog.view"><ProductCatalogPage /></RequirePermission>} />
              <Route path="/catalog/categories" element={<RequirePermission permission="catalog.view"><CatalogCategoriesPage /></RequirePermission>} />
              <Route path="/catalog/product-categories" element={<RequirePermission permission="catalog.view"><ProductCategoriesPage /></RequirePermission>} />
            </Route>

            {/* Catch-all: redirect unmatched routes to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </StepUpProvider>
          </DeleteConfirmProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
