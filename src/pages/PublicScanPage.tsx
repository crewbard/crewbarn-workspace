import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePublicScan } from '@/hooks/usePublicScan'
import { OwnerBar, OwnerSignInCard } from '@/components/scan/OwnerSignIn'
import { fetchOwnerIdentity, getOwnerToken, type OwnerIdentity } from '@/lib/assetOwner'

/**
 * Where the customer portal lives, for the "Access ›" link.
 *
 * Its own origin: assets.crewbarn.com and portal.crewbarn.com are
 * different sites, so this cannot be a router link.
 */
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'https://portal.crewbarn.com'
import { PublicScanNotFoundError, getPublicScan, submitAccessRequest, unlockSecuredScan } from '@/lib/publicScan'
import type {
  PublicScanAssetOpen,
  PublicScanGroupOpen,
  PublicScanLocationOpen,
  PublicScanNode,
  PublicScanDocumentSummary,
  PublicScanPhotoSummary,
  PublicScanCompliance,
  PublicScanReportHistoryEvent,
  PublicScanReportSummary,
  PublicScanRequiredFormSummary,
  PublicScanServicer,
  PublicScanCoverage,
  PublicScanParts,
  PublicServiceLogEntry,
  SecuredScanUnlock,
  ScanBreadcrumbStep,
  ScanChildEntry,
} from '@/types/publicScan'

/**
 * PublicScanPage - no-auth landing page for any QR-scanned scannable.
 *
 * Slice 3 (asset variant) + Slice 13b (extended to location + group).
 *
 * Dispatch by data.type:
 *   - 'asset'    -> existing asset views (SecuredAssetView / OpenAssetView)
 *   - 'location' -> SecuredNodeView OR LocationView
 *   - 'group'    -> SecuredNodeView OR GroupView
 *
 * Mounted at /scan/:code (legacy) and /scan/:tenantId/:code (Slice 3.5).
 * Registered OUTSIDE the ProtectedRoute wrapper so anonymous visitors
 * can reach it directly from a phone QR scan.
 */
export function PublicScanPage() {
  const { code, tenantId } = useParams<{ code: string; tenantId?: string }>()
  const [searchParams] = useSearchParams()
  const initialAccessCode = searchParams.get('access_code') ?? ''
  const { data, isLoading, error } = usePublicScan(code, tenantId)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
        {isLoading && <LoadingState />}
        {error instanceof PublicScanNotFoundError && <NotFoundState code={code} />}
        {error && !(error instanceof PublicScanNotFoundError) && <NetworkErrorState />}
        {data && (
          <>
            {/* Above everything: somebody who scanned an item and suddenly
                sees more should know why, and be able to sign out — the
                same browser might be a contractor's tomorrow. */}
            <SignedInOwnerBar tenantId={tenantId} />
            <NodeDispatch data={data} code={code!} tenantId={tenantId} initialAccessCode={initialAccessCode} />
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

/**
 * Who is signed in on this browser, if anyone.
 *
 * Asks the server rather than trusting what is in storage: a token that
 * has been revoked, or belongs to a session that has ended, must stop
 * claiming to be somebody.
 */
function SignedInOwnerBar({ tenantId }: { tenantId?: string }) {
  const [identity, setIdentity] = useState<OwnerIdentity | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let alive = true
    const token = getOwnerToken()

    if (!token) {
      setIdentity(null)
      return
    }

    void fetchOwnerIdentity(token).then((who) => {
      if (alive) setIdentity(who)
    })

    return () => {
      alive = false
    }
  }, [])

  if (!identity) return null

  return (
    <div className="mb-4">
      <OwnerBar
        identity={identity}
        scope="everything on your own equipment"
        accessUrl={tenantId ? `${PORTAL_URL}/equipment/access?tenant=${encodeURIComponent(tenantId)}` : null}
        onSignedOut={() => {
          setIdentity(null)
          void queryClient.invalidateQueries({ queryKey: ['public-scan'] })
        }}
      />
    </div>
  )
}

// ---------- Dispatch ----------

function NodeDispatch({
  data,
  code,
  tenantId,
  initialAccessCode,
}: {
  data: PublicScanNode
  code: string
  tenantId?: string
  initialAccessCode?: string
}) {
  // A legacy /scan/{code} sticker has no tenant in the URL, so every
  // tenant-scoped action below was unreachable and the access form gave up
  // with "ask the owner directly". The server resolved the tenant to answer
  // this request at all — use its answer.
  tenantId = tenantId ?? (data as { tenant_id?: string | null }).tenant_id ?? undefined

  if (data.type === 'asset') {
    if (data.is_secured) return <SecuredAssetView name={data.name} code={code} tenantId={tenantId} initialAccessCode={initialAccessCode} />
    return <OpenAssetView asset={data} tenantId={tenantId} code={code} />
  }
  if (data.type === 'location') {
    if (data.is_secured) {
      return (
        <SecuredNodeView
          name={data.name}
          kind="location"
          breadcrumb={data.breadcrumb}
          code={code}
          tenantId={tenantId}
          initialAccessCode={initialAccessCode}
        />
      )
    }
    return <LocationView node={data} tenantId={tenantId} />
  }
  if (data.type === 'group') {
    if (data.is_secured) {
      return (
        <SecuredNodeView
          name={data.name}
          kind="group"
          breadcrumb={data.breadcrumb}
          code={code}
          tenantId={tenantId}
          initialAccessCode={initialAccessCode}
        />
      )
    }
    return <GroupView node={data} tenantId={tenantId} />
  }
  return null
}

// ---------- Layout chrome ----------

function Header() {
  return (
    <header className="bg-white border-b border-slate-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <h1 className="text-lg font-semibold text-slate-900">CrewBarn</h1>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-4 print:hidden">
      <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
        Powered by{' '}
        <a href="https://crewbarn.com" className="text-amber-600 hover:underline">
          CrewBarn
        </a>
      </div>
    </footer>
  )
}

// ---------- States ----------

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
        <div className="h-7 w-3/4 bg-slate-200 rounded mb-2" />
        <div className="h-4 w-1/2 bg-slate-100 rounded" />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded" />
        <div className="h-4 w-full bg-slate-100 rounded" />
        <div className="h-4 w-2/3 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

function NotFoundState({ code }: { code?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
      <div className="text-5xl mb-3" aria-hidden="true">{"❔"}</div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Not found</h2>
      <p className="text-sm text-slate-600 mb-4">
        This QR code doesn't match any active asset, location, or group. The
        sticker may have been replaced, or this is an old code.
      </p>
      {code && (
        <p className="text-xs text-slate-400 font-mono break-all">Code: {code}</p>
      )}
    </div>
  )
}

function NetworkErrorState() {
  return (
    <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
      <div className="text-5xl mb-3" aria-hidden="true">{"⚠"}</div>
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Could not load</h2>
      <p className="text-sm text-slate-600">
        Check your internet connection and refresh the page.
      </p>
    </div>
  )
}

// ---------- Asset views (Slice 3, unchanged behavior) ----------

function SecuredAssetView({
  name,
  code,
  tenantId,
  initialAccessCode,
}: {
  name: string
  code: string
  tenantId?: string
  initialAccessCode?: string
}) {
  const [unlockedDetails, setUnlockedDetails] = useState<SecuredScanUnlock | null>(null)
  const queryClient = useQueryClient()

  return (
    <div className="space-y-4">
      {/*
        The owner's item, first and on its own.

        A private label was a dead end for the one person who should never
        have been stopped by it: it offered a code, and the code came from
        the servicer, who decided whether the building's owner could look
        at their own equipment. The most likely person holding a phone at a
        private item works in that building.
      */}
      <OwnerSignInCard
        onSignedIn={() => {
          // Re-fetch as them. The scan now carries their token, and the
          // server decides what that entitles them to — this page never
          // decides it locally.
          void queryClient.invalidateQueries({ queryKey: ['public-scan'] })
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div className="text-5xl mb-3" aria-hidden="true">{"🔒"}</div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">{name}</h2>
        <p className="text-sm text-slate-500 mb-6">This item is private</p>
        <p className="text-sm text-slate-600 mb-6">
          Inspector or contractor? The owner decides who can see this item.
          Ask them, and they can let you in.
        </p>
        <AccessCodeUnlock code={code} tenantId={tenantId} initialAccessCode={initialAccessCode} onUnlocked={setUnlockedDetails} />
        {!unlockedDetails && <RequestAccessForm code={code} tenantId={tenantId} />}
      </div>
    </div>
  )
}

function OpenAssetView({
  asset,
  tenantId,
  code,
}: {
  asset: PublicScanAssetOpen
  tenantId?: string
  code?: string
}) {
  const scannedTreeEntry: ScanChildEntry = {
    type: 'asset',
    id: asset.id,
    name: asset.name,
    code: asset.code ?? code ?? null,
    is_secured: false,
    asset_type_name: asset.asset_type_name,
    tag: asset.tag,
    path: pathFromBreadcrumb(asset.breadcrumb),
    physical: asset.physical,
    documents: asset.documents,
    photos: asset.photos,
    report: asset.report,
    // The scanned item's own work, which only the root payload carries.
    // Left off this list, the service history and the parts row rendered
    // nowhere at all: the panel reads the tree entry, not the response.
    service_log: asset.service_log,
    parts: asset.parts,
    coverage: asset.coverage,
    last_serviced_at: asset.last_serviced_at,
    open_priority: asset.open_priority,
  }
  const [selectedTreeAsset, setSelectedTreeAsset] = useState<ScanChildEntry>(scannedTreeEntry)

  useEffect(() => {
    setSelectedTreeAsset(scannedTreeEntry)
  }, [asset.id, asset.code, code])

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] print:block">
      {asset.breadcrumb && asset.breadcrumb.length > 0 && (
        <div className="lg:col-span-2 print:hidden">
          <BreadcrumbBar steps={asset.breadcrumb} tenantId={tenantId} />
        </div>
      )}

      {asset.tree && asset.tree.length > 0 ? (
        <AssetTreeCard
          tree={asset.tree}
          selectedAssetId={selectedTreeAsset.id}
          scannedAssetId={asset.selected_asset_id ?? asset.id}
          tenantId={tenantId}
          onAssetSelect={setSelectedTreeAsset}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500 lg:sticky lg:top-4 lg:self-start">
          No asset tree has been built for this location yet.
        </div>
      )}

      <AssetSelectionDetails
        selectedAsset={selectedTreeAsset}
        tenantId={tenantId}
        scannedAssetId={asset.id}
      />
    </div>
  )
}

function PublicTreeAssetSummary({
  asset,
  isScannedAsset,
  tenantId,
}: {
  asset: ScanChildEntry
  isScannedAsset: boolean
  tenantId?: string
}) {
  const [unlockedDetails, setUnlockedDetails] = useState<SecuredScanUnlock | null>(null)
  const [reportGeneratedAt] = useState(() => new Date().toLocaleString())

  useEffect(() => {
    setUnlockedDetails(null)
  }, [asset.id])
  const hasAnyPhysical =
    !!asset.physical?.manufacturer ||
    !!asset.physical?.model ||
    !!asset.physical?.serial_number ||
    !!asset.physical?.install_date
  const canOpenScan = !!tenantId && !!asset.code && !isScannedAsset
  const actionLabel = 'Open direct QR page'
  const selectionContext = isScannedAsset ? 'Scanned QR' : 'Tree selection'
  const warnings = asset.report?.warnings ?? []
  const publicDocuments = asset.documents ?? []
  const publicPhotos = asset.photos ?? []
  const requiredForms = asset.report?.required_forms ?? []
  const history = asset.report?.history
  const historyEvents = history?.recent_events ?? []
  const serviceLog = asset.service_log ?? []
  const parts = asset.parts
  const coverage = asset.coverage ?? null
  const assetPath = asset.path ?? []
  // Compliance outranks everything else. This used to read is_secured and
  // warnings only, so an asset months past a required inspection — with no
  // warning rows — told an inspector "Ready". The due date was already in the
  // payload; nothing consulted it.
  const compliance = asset.report?.compliance ?? null
  const overdue = compliance?.state === 'overdue'
  const reportStatus = overdue
    ? compliance!.label
    : asset.is_secured
      ? 'Locked'
      : warnings.length > 0
        ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
        : (compliance?.label ?? 'Ready')
  const reportTone: 'neutral' | 'ready' | 'warning' | 'locked' | 'overdue' = overdue
    ? 'overdue'
    : compliance?.state === 'due' || compliance?.state === 'due_soon'
      ? 'warning'
      : warnings.length > 0
        ? 'warning'
        : asset.is_secured
          ? 'locked'
          : 'ready'
  const reportTitle = `${asset.name} asset report`
  const reportSections: AssetReportPrintSection[] = [
    {
      title: 'Asset identity',
      rows: [
        ['Name', asset.name],
        ['Type', asset.asset_type_name || 'Not captured'],
        ['Code / QR', asset.code || 'System generated'],
        ['Secured', asset.is_secured ? 'Yes - approval required' : 'No'],
      ],
    },
    {
      title: 'Location tree',
      rows: [
        ['Path', assetPath.length > 0 ? assetPath.join(' > ') : 'No group selected'],
        ['Display', `${asset.name}${assetPath.length > 0 ? ` at ${assetPath[assetPath.length - 1]}` : ''}`],
      ],
    },
    {
      title: 'Physical details',
      rows: [
        ['Manufacturer', asset.physical?.manufacturer || 'Not captured'],
        ['Model', asset.physical?.model || 'Not captured'],
        ['Serial', asset.physical?.serial_number || 'Not captured'],
        ['Install date', asset.physical?.install_date || 'Not captured'],
      ],
    },
    {
      title: 'Inspection readiness',
      rows: [
        ['Inspection cadence', labelize(asset.report?.inspection_cadence) || 'Not captured'],
        ['Last inspected', asset.report?.last_inspected_at || 'No record'],
        ['Next due', asset.report?.next_due_at || 'Not scheduled'],
        ['Photos', `${publicPhotos.length} linked`],
        ['Documents', `${publicDocuments.length} linked`],
        ['Required forms', requiredForms.length > 0 ? requiredForms.map((form) => form.name).join(', ') : 'None configured'],
      ],
    },
    {
      title: 'Work history',
      rows: [
        ['Inspections', `${history?.inspection_count ?? 0} linked`],
        ['Inventory parts', `${history?.inventory_count ?? 0} linked`],
        ['Required forms', requiredForms.length > 0 ? requiredForms.map((form) => form.name).join(', ') : 'None configured'],
      ],
    },
    ...(historyEvents.length > 0 ? [{
      title: 'Recent asset history',
      rows: historyEvents.slice(0, 8).map((event) => [
        [event.label || labelize(event.type), event.reference].filter(Boolean).join(' '),
        [event.title, event.status ? labelize(event.status) : '', event.date ? formatShortDate(event.date) : ''].filter(Boolean).join(' - '),
      ] as [string, string]),
    }] : []),
    {
      title: 'Linked files',
      rows: [
        ['Manuals / docs', publicDocuments.length > 0 ? `${publicDocuments.length} attached` : 'None attached'],
        ['Signed docs', publicDocuments.filter((document) => !!document.signed_at || document.signature_count > 0).length > 0 ? 'Present' : 'None attached'],
        ['Photo evidence', publicPhotos.length > 0 ? `${publicPhotos.length} attached` : 'None attached'],
        ['Required forms', requiredForms.length > 0 ? requiredForms.map((form) => form.name).join(', ') : 'None configured'],
      ],
    },
  ]
  const printReport = () => openAssetReportPrintWindow({
    title: reportTitle,
    subtitle: asset.is_secured
      ? 'Public asset report. Secured fields require owner approval before they can be viewed.'
      : 'Public asset report with linked documents, photos, and readiness details.',
    generatedAt: reportGeneratedAt,
    warnings,
    sections: reportSections,
    documents: publicDocuments,
    photos: publicPhotos,
  })

  return (
    <section className="space-y-4 min-w-0 print:space-y-3">
      {/* Compliance leads. The person holding the phone is usually an
          inspector standing at the item, and this is the only thing they came
          for — it used to be a small tile six stats along. */}
      {isScannedAsset && <ComplianceBanner compliance={compliance} report={asset.report} />}

      {isScannedAsset && asset.servicer && <ServicerCard servicer={asset.servicer} />}

      {/* Somebody looks after this, and here is when they are next due.
          The most reassuring line on the page for whoever is standing in
          front of the equipment wondering whether anybody is on it. */}
      {isScannedAsset && coverage && <CoverageCard coverage={coverage} />}

      {/* What went on and what is still waiting, before the timeline,
          because it is the answer to the question people actually have. */}
      {isScannedAsset && parts && <PartsRow parts={parts} />}

      {isScannedAsset && asset.report?.last_inspection_id && (
        <Link
          to={`/verify/${asset.report.last_inspection_id}`}
          className="block rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
        >
          Verify this record independently
        </Link>
      )}

      {isScannedAsset && (serviceLog.length > 0 || historyEvents.length > 0) && (
        <ServiceHistory entries={serviceLog} events={historyEvents} />
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {isScannedAsset ? 'Scanned asset' : 'Selected asset'}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 break-words">{asset.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {asset.asset_type_name && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {asset.asset_type_name}
                  </span>
                )}
                {asset.is_secured && (
                  <span className="rounded-full bg-slate-900 px-2 py-1 font-medium text-white">
                    Secured
                  </span>
                )}
                {asset.code && <span className="font-mono break-all">{asset.code}</span>}
                {/* The building's own number, beside ours. Somebody
                    standing in front of it recognises "FD-201" from the
                    door schedule long before they recognise A-7K2M9Q. */}
                {asset.tag && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                    {asset.tag}
                  </span>
                )}
              </div>
              {assetPath.length > 0 && (
                <p className="mt-3 text-sm text-slate-600 break-words">
                  {assetPath.join(' > ')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              {!asset.is_secured && (
                <button
                  type="button"
                  onClick={printReport}
                  className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Print report / save PDF
                </button>
              )}
              {canOpenScan && (
                <Link
                  to={`/scan/${tenantId}/${encodeURIComponent(asset.code!)}`}
                  className={`inline-flex rounded-lg px-3 py-2 text-sm font-medium ${
                    asset.is_secured
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {actionLabel}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-6 sm:p-6">
          <MiniStat label="Source" value={selectionContext} />
          <MiniStat label="Report status" value={reportStatus} tone={reportTone} />
          <MiniStat label="Public docs" value={`${publicDocuments.length}`} />
          <MiniStat label="Photos" value={`${publicPhotos.length}`} />
          <MiniStat label="History" value={`${history?.event_count ?? 0}`} />
          <MiniStat label="Required forms" value={`${requiredForms.length}`} tone={requiredForms.length > 0 ? 'warning' : 'ready'} />
        </div>

        {!isScannedAsset && (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600 sm:px-6">
            {asset.is_secured
              ? 'This secured asset was selected from the location tree. Request owner approval here, enter an approved key, or open the direct QR page.'
              : 'This asset was selected from the location tree and loaded from its QR record. Inspect public files here, or open the direct QR page.'}
          </div>
        )}

        <div className="border-b border-slate-100 p-5 sm:p-6">
          <AssetVisibilityCard isSecured={asset.is_secured} hasUnlockedDetails={!!unlockedDetails} />
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2 sm:p-6">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Asset / equipment
            </h3>
            {asset.is_secured ? (
              <div className="space-y-2 text-sm text-slate-600">
                <p>Visible now: asset name, type, code, and tree position.</p>
                <p>Locked until approved: secured notes, sensitive fields, owner-approved files, and protected report details.</p>
              </div>
            ) : hasAnyPhysical ? (
              <dl className="space-y-2 text-sm">
                {asset.physical?.manufacturer && <Row label="Manufacturer" value={asset.physical.manufacturer} />}
                {asset.physical?.model && <Row label="Model" value={asset.physical.model} />}
                {asset.physical?.serial_number && <Row label="Serial" value={asset.physical.serial_number} mono />}
                {asset.physical?.install_date && <Row label="Installed" value={asset.physical.install_date} />}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No public asset details have been added yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Public record
            </h3>
            <dl className="space-y-2 text-sm">
              <Row label="Selection" value={selectionContext} />
              <Row label="Asset type" value={asset.asset_type_name || 'Not captured'} />
              <Row label="Tree path" value={assetPath.length > 0 ? assetPath.join(' > ') : 'Not grouped'} />
              <Row label="QR / code" value={asset.code || 'Not captured'} mono={!!asset.code} />
              <Row label="Documents" value={`${publicDocuments.length}`} />
              <Row label="Photos" value={`${publicPhotos.length}`} />
              <Row label="Secure data" value={asset.is_secured ? (unlockedDetails ? 'Unlocked for this visit' : 'Locked') : 'Not secured'} />
              <Row label="Warnings" value={`${warnings.length}`} />
            </dl>
          </div>
        </div>
      </div>

      {!asset.is_secured && <PublicAssetPhotosCard photos={publicPhotos} />}

      {!asset.is_secured && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">CrewBarn asset report</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{reportTitle}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Public QR report for inspectors, customers, and approved visitors. Secured fields are not included here.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-right text-xs text-slate-500 print:bg-white">
                <div className="font-semibold uppercase tracking-wide text-slate-400">Generated</div>
                <div className="mt-1 text-slate-700">{reportGeneratedAt}</div>
              </div>
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Warnings</h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-4 p-5 lg:grid-cols-2 sm:p-6">
            <ReportFactCard
              title="Asset identity"
              rows={[
                ['Asset', asset.name],
                ['Type', asset.asset_type_name || 'Not captured'],
                ['QR / code', asset.code || 'Not captured'],
                ['Selection source', selectionContext],
                ['Status', reportStatus],
                ['Generated', reportGeneratedAt],
              ]}
            />
            <ReportFactCard
              title="Location tree"
              rows={[
                ['Path', assetPath.length > 0 ? assetPath.join(' > ') : 'Not grouped'],
                ['Selected from scan', isScannedAsset ? 'Yes' : 'No'],
                ['Secure data', asset.is_secured ? 'Locked' : 'Not secured'],
              ]}
            />
            <ReportFactCard
              title="Physical details"
              rows={[
                ['Manufacturer', asset.physical?.manufacturer || 'Not captured'],
                ['Model', asset.physical?.model || 'Not captured'],
                ['Serial', asset.physical?.serial_number || 'Not captured'],
                ['Installed', asset.physical?.install_date || 'Not captured'],
              ]}
            />
            <ReportFactCard
              title="Inspection readiness"
              rows={[
                ['Cadence', labelize(asset.report?.inspection_cadence) || 'Not captured'],
                ['Last inspected', asset.report?.last_inspected_at || 'No record'],
                ['Next due', asset.report?.next_due_at || 'Not scheduled'],
                ['Inspection records', `${history?.inspection_count ?? 0}`],
              ]}
            />
            <ReportFactCard
              title="Work history"
              rows={[
                ['Inspections', `${history?.inspection_count ?? 0}`],
                ['Inventory changes', `${history?.inventory_count ?? 0}`],
                ['Events on record', `${history?.event_count ?? 0}`],
              ]}
            />
            <AssetHistoryEventsCard events={historyEvents} />
            <RequiredFormsCard forms={requiredForms} />
            <ReportFactCard
              title="Linked files"
              rows={[
                ['Public documents', `${publicDocuments.length}`],
                ['Viewable files', `${publicDocuments.filter((document) => !!document.file_url).length}`],
                ['Signed docs', `${publicDocuments.filter((document) => !!document.signed_at || document.signature_count > 0).length}`],
                ['Public photos', `${publicPhotos.length}`],
                ['Included in print', publicDocuments.length > 0 ? 'Report packet + public file links' : 'Report packet only'],
              ]}
            />
          </div>
        </div>
      )}

      {!asset.is_secured && <PrintableDocumentLinks documents={publicDocuments} />}

      {asset.is_secured && asset.code && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Secured asset access
          </h3>
          <p className="mb-4 text-sm text-slate-600">
            The asset is visible in the tree, but sensitive fields stay locked until the owner approves access or gives you a one-time key.
          </p>
          <AccessCodeUnlock code={asset.code} tenantId={tenantId} onUnlocked={setUnlockedDetails} />
          {!unlockedDetails && (
            <RequestAccessForm
              code={asset.code}
              tenantId={tenantId}
              servicerName={asset.servicer?.name}
              offerWholeSite={assetPath.length > 0}
            />
          )}
        </div>
      )}

      {!asset.is_secured && <PublicAssetDocumentsCard documents={publicDocuments} />}
    </section>
  )
}

function AssetVisibilityCard({
  isSecured,
  hasUnlockedDetails,
}: {
  isSecured: boolean
  hasUnlockedDetails: boolean
}) {
  if (isSecured) {
    return (
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible from the QR</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Asset name, type, QR/code, and location tree position.</li>
            <li>Enough context for an inspector or visitor to confirm they are on the right asset.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locked until approved</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Secured notes, sensitive fields, secured files, and private job/customer data.</li>
            <li>{hasUnlockedDetails ? 'Access is unlocked for this visit.' : 'Request access or enter a one-time security key below.'}</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Public QR visibility</h3>
      <p className="mt-2">
        This asset record is open: the QR page can show the public report packet, shared documents, shared photos, and inspection readiness. Internal notes, private customer data, and secured files are not shown here.
      </p>
    </div>
  )
}
function PublicAssetPhotosCard({ photos }: { photos: PublicScanPhotoSummary[] }) {
  if (photos.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Public photos</h3>
        <p className="mt-1 text-sm text-slate-500">Shared asset photos visible from the QR record.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => {
          const imageUrl = photo.medium_url || photo.thumb_url || photo.full_url
          const title = photo.caption || photo.original_filename || 'Asset photo'
          if (!imageUrl) return null
          return (
            <a
              key={photo.id}
              href={photo.full_url || imageUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:border-amber-300"
            >
              <div className="aspect-[4/3] bg-slate-100">
                <img src={imageUrl} alt={title} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">{title}</p>
                {photo.created_at && <p className="mt-1 text-xs text-slate-500">{formatShortDate(photo.created_at)}</p>}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
function PrintableDocumentLinks({
  documents,
  title = 'Report file links',
  description = 'Public documents and files attached to this asset report.',
}: {
  documents: PublicScanDocumentSummary[]
  title?: string
  description?: string
}) {
  const readableDocuments = documents.filter((document) => !!document.file_url)
  if (readableDocuments.length === 0) return null

  return (
    <div className="hidden bg-white border border-slate-200 rounded-xl overflow-hidden print:block print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="divide-y divide-slate-100 p-5 sm:p-6">
        {readableDocuments.map((document) => {
          const title = document.title || document.original_filename || document.document_number || 'Asset document'
          return (
            <div key={document.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {[document.document_number, labelize(document.document_type), labelize(document.source_type), formatBytes(document.size_bytes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {document.signed_at && (
                <p className="mt-1 text-xs text-emerald-700">
                  Signed{document.signed_by_name ? ` by ${document.signed_by_name}` : ''}
                </p>
              )}
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-slate-700">{document.file_url}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function RequiredFormsCard({
  forms,
  title = 'Required forms / checklists',
}: {
  forms: PublicScanRequiredFormSummary[]
  title?: string
}) {
  if (forms.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
        No required forms are configured for this asset type.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="space-y-3">
        {forms.map((form) => (
          <div key={form.id} className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{form.name}</p>
              {form.standard && form.standard !== 'none' && (
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                  {labelize(form.standard)}
                </span>
              )}
              {form.template_type && (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                  {labelize(form.template_type)}
                </span>
              )}
            </div>
            {form.description && <p className="mt-2 text-sm text-slate-600">{form.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              {form.approved_format_required && form.approved_format_required !== 'no' && (
                <span>Approved format: {labelize(form.approved_format_required)}</span>
              )}
              {form.jurisdiction && <span>Jurisdiction: {form.jurisdiction}</span>}
              {form.requires_owner_signature && <span>Owner signature required</span>}
              {form.requires_ahj_submission && <span>AHJ submission required</span>}
              {form.requires_inspector_permit_number && <span>Inspector permit # required</span>}
              {form.export_formats.length > 0 && <span>Export: {form.export_formats.join(', ').toUpperCase()}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function AssetHistoryEventsCard({
  events,
  title = 'Recent asset history',
}: {
  events: PublicScanReportHistoryEvent[]
  title?: string
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
        No jobs, estimates, inspections, or inventory events are linked to this asset yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="space-y-3">
        {events.slice(0, 8).map((event, index) => (
          <div key={`${event.type}-${event.reference ?? 'event'}-${event.date ?? index}`} className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                {event.label || labelize(event.type) || 'Event'}
              </span>
              {event.reference && <span className="font-mono text-slate-500">{event.reference}</span>}
              {event.status && <span className="text-slate-500">{labelize(event.status)}</span>}
              {event.date && <span className="text-slate-400">{formatShortDate(event.date)}</span>}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">{event.title || 'Asset activity'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
function ReportFactCard({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, string]>
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} mono={label.toLowerCase().includes('code') || label.toLowerCase() === 'serial'} />
        ))}
      </dl>
    </div>
  )
}
/**
 * The compliance verdict, full width, at the top of the record.
 *
 * Colour comes from the server's state rather than being recomputed here, so
 * the banner can't disagree with the API — that split is what let an overdue
 * asset render green in the first place.
 */
function ComplianceBanner({
  compliance,
  report,
}: {
  compliance?: PublicScanCompliance | null
  report?: PublicScanReportSummary | null
}) {
  if (!compliance) return null

  const tone =
    compliance.state === 'overdue'
      ? { bg: 'bg-rose-700', sub: 'text-rose-100' }
      : compliance.state === 'due' || compliance.state === 'due_soon'
        ? { bg: 'bg-amber-600', sub: 'text-amber-100' }
        : compliance.state === 'current'
          ? { bg: 'bg-emerald-700', sub: 'text-emerald-100' }
          : { bg: 'bg-slate-600', sub: 'text-slate-200' }

  return (
    <div className={`${tone.bg} rounded-xl p-5 text-white sm:p-6`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.06em] ${tone.sub}`}>
        Compliance status
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[25px]">
        {compliance.label}
      </p>
      <div className="mt-3 flex flex-wrap gap-6">
        <div>
          <p className={`text-[11px] ${tone.sub}`}>Last inspected</p>
          <p className="text-sm font-bold">{report?.last_inspected_at ?? 'No record'}</p>
        </div>
        <div>
          <p className={`text-[11px] ${tone.sub}`}>Next due</p>
          <p className="text-sm font-bold">{report?.next_due_at ?? 'Not scheduled'}</p>
        </div>
        {report?.inspection_cadence && (
          <div>
            <p className={`text-[11px] ${tone.sub}`}>Cadence</p>
            <p className="text-sm font-bold">{labelize(report.inspection_cadence)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Who services this, and their licence — the second question an AHJ asks
 * after "is it in date". The phone is a real tel: link because the person
 * reading it is standing in a stairwell.
 */
/**
 * On a service plan.
 *
 * The rhythm and the next visit, and nothing about what it costs. A
 * property manager standing in front of something broken wants to know
 * whether anybody is already coming before they pick up the phone.
 */
function CoverageCard({ coverage }: { coverage: PublicScanCoverage }) {
  const bits = [coverage.how_often, coverage.next_visit ? `next visit ${coverage.next_visit}` : null]
    .filter(Boolean)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-emerald-700">
        On a service plan
      </p>
      <p className="mt-1 text-sm font-semibold text-emerald-900 break-words">
        {coverage.service || 'Covered by a maintenance agreement'}
      </p>
      {bits.length > 0 && (
        <p className="mt-0.5 text-sm text-emerald-800">{bits.join(' · ')}</p>
      )}
    </div>
  )
}

/**
 * What went on, and what is still waiting.
 *
 * Deliberately two short lines rather than a table: the question is "has
 * anything been done to this, and is anything outstanding", and a table
 * makes somebody read to find out.
 */
function PartsRow({ parts }: { parts: PublicScanParts }) {
  const replaced = parts.replaced ?? []
  const needed = parts.needed ?? []

  if (replaced.length === 0 && needed.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Parts</p>
      <div className="mt-2 space-y-2">
        {replaced.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-slate-700">Replaced</span>
            <span className="text-slate-600 break-words">
              {replaced.map((p) => (p.on ? `${p.name} (${p.on})` : p.name)).join(', ')}
            </span>
          </div>
        )}
        {needed.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-amber-700">Needed</span>
            <span className="text-slate-600 break-words">
              {needed.map((p) => `${p.name} (${p.state.toLowerCase()})`).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The part, but only when it says something the summary did not.
 *
 * "Economizer actuator has failed (Economizer actuator)" is the tech
 * writing a good note and the page repeating it back at them. A quantity
 * is always worth showing; a bare name the sentence already contains is
 * not.
 */
function partDetail(entry: PublicServiceLogEntry): string | null {
  const part = entry.part
  if (!part) return null

  const detail = [part.quantity, part.unit, part.name].filter(Boolean).join(' ')
  if (!detail) return null

  const named = part.name && (entry.summary ?? '').toLowerCase().includes(part.name.toLowerCase())
  if (named && !part.quantity) return null

  return detail
}

type VisitGroup = {
  key: string
  /** What the heading reads: "Oct 14, 2026". */
  date: string
  time: string | null
  by: string | null
  company: string | null
  entries: PublicServiceLogEntry[]
  others: { label: string; title: string; status: string | null }[]
}

/**
 * Service history, grouped by the visit it happened on.
 *
 * A flat list made one visit look like six separate events, so something
 * serviced twice a year read as a dozen callouts. Grouping by day and tech
 * is what actually happened: somebody turned up once and did several
 * things.
 *
 * Inspections and inventory installs fold into the same list, because to
 * whoever is reading it they are all "somebody was here and did this".
 */
function ServiceHistory({
  entries,
  events,
}: {
  entries: PublicServiceLogEntry[]
  events: { type: string; label?: string | null; title?: string | null; date?: string | null; status?: string | null }[]
}) {
  const groups = new Map<string, VisitGroup>()

  const groupFor = (key: string, date: string, time: string | null, by: string | null, company: string | null) => {
    const existing = groups.get(key)
    if (existing) return existing
    const made: VisitGroup = { key, date, time, by, company, entries: [], others: [] }
    groups.set(key, made)
    return made
  }

  for (const entry of entries) {
    // Day AND tech: two people on site the same day is two visits, and
    // reading them as one puts somebody else's work under a name.
    const key = `${entry.date_key ?? entry.date ?? 'unknown'}|${entry.by ?? ''}`
    groupFor(key, entry.date ?? 'Undated', entry.time, entry.by, entry.company).entries.push(entry)
  }

  for (const event of events) {
    const iso = event.date ? event.date.slice(0, 10) : 'unknown'
    const shown = event.date ? formatShortDate(event.date) : 'Undated'
    const group = groupFor(`${iso}|`, shown, null, null, null)
    group.others.push({
      label: event.label || labelize(event.type),
      title: event.title || labelize(event.type),
      status: event.status ? labelize(event.status) : null,
    })
  }

  // Newest first. The key starts with the property's own YYYY-MM-DD, so a
  // string compare is a date compare without re-parsing anything.
  const ordered = [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 print:hidden">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
        Service history
      </p>
      <ol className="mt-3 space-y-4">
        {ordered.map((group) => (
          <li key={group.key} className="border-l-2 border-slate-200 pl-3 sm:pl-4">
            <p className="text-sm font-semibold text-slate-900 break-words">
              {[group.date, group.by, group.time].filter(Boolean).join(' · ')}
            </p>
            {group.company && (
              <p className="text-xs text-slate-500 break-words">{group.company}</p>
            )}
            <ul className="mt-2 space-y-2">
              {group.entries.map((entry, index) => (
                <li key={`e${index}`} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-600">{entry.kind}</span>
                  {entry.summary && <span className="break-words"> — {entry.summary}</span>}
                  {partDetail(entry) && (
                    <span className="text-slate-500 break-words"> ({partDetail(entry)})</span>
                  )}
                  {entry.need && (
                    <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {entry.need}
                    </span>
                  )}
                  {entry.priority_word && entry.priority !== 'low' && (
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {entry.priority_word}
                    </span>
                  )}
                  {entry.result && (
                    <span className="ml-1 text-xs text-slate-500">{entry.result}</span>
                  )}
                  {entry.skipped_because && (
                    <span className="ml-1 text-xs text-slate-500">{entry.skipped_because}</span>
                  )}
                  {entry.photos && entry.photos.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {entry.photos.map((photo, i) => (
                        <a key={i} href={photo.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={photo.thumb_url || photo.url}
                            alt={photo.phase ? `${photo.phase} photo` : 'Service photo'}
                            loading="lazy"
                            className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                          />
                          {photo.phase && (
                            <span className="mt-0.5 block text-center text-[10px] uppercase tracking-wide text-slate-500">
                              {photo.phase}
                            </span>
                          )}
                        </a>
                      ))}
                    </span>
                  )}
                </li>
              ))}
              {group.others.map((other, index) => (
                <li key={`o${index}`} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-600">{other.label}</span>
                  <span className="break-words"> — {other.title}</span>
                  {other.status && <span className="ml-1 text-xs text-slate-500">{other.status}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ServicerCard({ servicer }: { servicer: PublicScanServicer }) {
  const tel = servicer.phone?.replace(/[^\d+]/g, '')
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
        Serviced by
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white">
          {servicer.name.slice(0, 3).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{servicer.name}</p>
          {servicer.license_number ? (
            <p className="text-xs text-slate-500">Lic. #{servicer.license_number}</p>
          ) : (
            <p className="text-xs text-slate-400">License not published</p>
          )}
        </div>
        {tel && (
          <a
            href={`tel:${tel}`}
            className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100"
          >
            Call
          </a>
        )}
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ready' | 'warning' | 'locked' | 'overdue'
}) {
  const toneClass =
    tone === 'overdue'
      ? 'text-rose-700'
      : tone === 'ready'
        ? 'text-emerald-700'
        : tone === 'warning'
          ? 'text-amber-700'
          : tone === 'locked'
            ? 'text-slate-700'
            : 'text-slate-900'
  // Overdue gets the whole tile, not just the text — an inspector scanning a
  // wall of stats shouldn't have to read every one to find the failure.
  const boxClass =
    tone === 'overdue' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'
  return (
    <div className={`rounded-lg border p-3 ${boxClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function PublicAssetDocumentsCard({
  documents,
  title = 'Public documents',
  description = 'Open shared manuals, forms, reports, and signed documents without leaving this page.',
  emptyText = 'No public QR documents are attached.',
  noFilesText = 'Public documents are listed, but no viewable files are attached yet.',
}: {
  documents: PublicScanDocumentSummary[]
  title?: string
  description?: string
  emptyText?: string
  noFilesText?: string
}) {
  const readableDocuments = documents.filter((document) => !!document.file_url)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(readableDocuments[0]?.id ?? null)

  useEffect(() => {
    setSelectedDocumentId(readableDocuments[0]?.id ?? null)
  }, [readableDocuments.map((document) => document.id).join('|')])

  const selectedDocument = readableDocuments.find((document) => document.id === selectedDocumentId) ?? readableDocuments[0] ?? null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {documents.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">{emptyText}</p>
      ) : readableDocuments.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">{noFilesText}</p>
      ) : (
        <div className="grid min-h-[420px] lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
            {readableDocuments.map((document) => {
              const selected = document.id === selectedDocument?.id
              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedDocumentId(document.id)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${selected ? 'bg-amber-50' : ''}`}
                >
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {document.title || document.original_filename || document.document_number || 'Asset document'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[document.document_number, labelize(document.source_type), formatBytes(document.size_bytes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {document.signed_at && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Signed{document.signed_by_name ? ` by ${document.signed_by_name}` : ''}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          <PublicDocumentReader document={selectedDocument} />
        </div>
      )}
    </div>
  )
}

function PublicDocumentReader({ document }: { document: PublicScanDocumentSummary | null }) {
  if (!document?.file_url) {
    return <div className="flex items-center justify-center p-6 text-sm text-slate-500">Select a document to preview.</div>
  }

  const title = document.title || document.original_filename || document.document_number || 'Asset document'
  const isPdf = isPdfDocument(document)
  const isImage = isImageDocument(document)

  return (
    <div className="min-w-0 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            {[labelize(document.document_type), document.mime_type, formatBytes(document.size_bytes)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <a
          href={document.file_url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open full file
        </a>
      </div>
      <div className="p-4">
        {isPdf ? (
          <object data={document.file_url} type="application/pdf" className="h-[620px] w-full rounded-lg border border-slate-200 bg-white">
            <div className="p-6 text-sm text-slate-600">
              This browser cannot preview the PDF here. Use Open full file to view or download it.
            </div>
          </object>
        ) : isImage ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-white p-3">
            <img src={document.file_url} alt={title} className="max-h-[620px] max-w-full rounded object-contain" />
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            This file type is available for download but cannot be previewed inline.
          </div>
        )}
      </div>
    </div>
  )
}

function AssetTreeCard({
  tree,
  selectedAssetId,
  scannedAssetId,
  tenantId,
  onAssetSelect,
}: {
  tree: ScanChildEntry[]
  selectedAssetId: string
  scannedAssetId: string
  tenantId?: string
  onAssetSelect: (entry: ScanChildEntry) => void
}) {
  return (
    <aside className="bg-white border border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-4 lg:self-start print:hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset tree</h3>
        <p className="mt-1 text-xs text-slate-500">Click an asset to view its public record. Secure details stay locked.</p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
        {tree.map((entry) => (
          <AssetTreeNode
            key={entry.id}
            entry={entry}
            selectedAssetId={selectedAssetId}
            scannedAssetId={scannedAssetId}
            tenantId={tenantId}
            onAssetSelect={onAssetSelect}
            depth={0}
          />
        ))}
      </div>
    </aside>
  )
}

function AssetTreeNode({
  entry,
  selectedAssetId,
  scannedAssetId,
  tenantId,
  onAssetSelect,
  depth,
}: {
  entry: ScanChildEntry
  selectedAssetId: string
  scannedAssetId: string
  tenantId?: string
  onAssetSelect: (entry: ScanChildEntry) => void
  depth: number
}) {
  const selected = entry.type === 'asset' && entry.id === selectedAssetId
  const scanned = entry.type === 'asset' && entry.id === scannedAssetId
  const linkable = entry.type === 'group' && !!tenantId && !!entry.code
  const row = (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${selected ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : ''}`}
      style={{ paddingLeft: `${16 + depth * 18}px` }}
    >
      <div className="text-xl flex-shrink-0" aria-hidden="true">
        {entry.is_secured ? '🔒' : entry.type === 'group' ? '📂' : '🔧'}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${selected ? 'font-semibold text-amber-900' : 'font-medium text-slate-900'}`}>
          {entry.name}
        </div>
        <div className="text-xs text-slate-500">
          {entry.type === 'group' ? formatGroupSubtitle(entry) : scanned ? 'Scanned asset' : entry.asset_type_name || 'Asset'}
        </div>
      </div>
      {selected && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Selected</span>}
      {linkable && <span className="text-amber-600 text-xs flex-shrink-0">{'›'}</span>}
    </div>
  )

  return (
    <div>
      {entry.type === 'asset' ? (
        <button
          type="button"
          onClick={() => onAssetSelect(entry)}
          className="block w-full text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300"
          aria-current={selected ? 'true' : undefined}
        >
          {row}
        </button>
      ) : linkable ? (
        <Link to={`/scan/${tenantId}/${encodeURIComponent(entry.code!)}`} className="block hover:bg-slate-50">
          {row}
        </Link>
      ) : row}
      {entry.children && entry.children.length > 0 && (
        <div className="border-t border-slate-100">
          {entry.children.map((child) => (
            <AssetTreeNode
              key={child.id}
              entry={child}
              selectedAssetId={selectedAssetId}
              scannedAssetId={scannedAssetId}
              tenantId={tenantId}
              onAssetSelect={onAssetSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// ---------- Location + Group views (Slice 13b) ----------

function LocationView({
  node,
  tenantId,
}: {
  node: PublicScanLocationOpen
  tenantId?: string
}) {
  const addrLine = formatAddress(node.address)
  const firstAsset = findFirstAsset(node.children)
  const [selectedAsset, setSelectedAsset] = useState<ScanChildEntry | null>(firstAsset)

  useEffect(() => {
    setSelectedAsset(firstAsset)
  }, [node.id])

  return (
    <div className="space-y-4">
      <BreadcrumbBar steps={node.breadcrumb} tenantId={tenantId} />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
          Service location
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">{node.name}</h2>
        {addrLine && <p className="text-sm text-slate-600">{addrLine}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] print:block">
        {node.children.length > 0 ? (
          <AssetTreeCard
            tree={node.children}
            selectedAssetId={selectedAsset?.id ?? ''}
            scannedAssetId=""
            tenantId={tenantId}
            onAssetSelect={setSelectedAsset}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500 lg:sticky lg:top-4 lg:self-start">
            No asset tree has been built for this location yet.
          </div>
        )}
        <AssetSelectionDetails selectedAsset={selectedAsset} tenantId={tenantId} />
      </div>
    </div>
  )
}

function GroupView({
  node,
  tenantId,
}: {
  node: PublicScanGroupOpen
  tenantId?: string
}) {
  const firstAsset = findFirstAsset(node.children)
  const [selectedAsset, setSelectedAsset] = useState<ScanChildEntry | null>(firstAsset)

  useEffect(() => {
    setSelectedAsset(firstAsset)
  }, [node.id])

  return (
    <div className="space-y-4">
      <BreadcrumbBar steps={node.breadcrumb} tenantId={tenantId} />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Group</p>
        <h2 className="text-2xl font-semibold text-slate-900">{node.name}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] print:block">
        {node.children.length > 0 ? (
          <AssetTreeCard
            tree={node.children}
            selectedAssetId={selectedAsset?.id ?? ''}
            scannedAssetId=""
            tenantId={tenantId}
            onAssetSelect={setSelectedAsset}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500 lg:sticky lg:top-4 lg:self-start">
            No assets have been added under this group yet.
          </div>
        )}
        <AssetSelectionDetails selectedAsset={selectedAsset} tenantId={tenantId} />
      </div>
    </div>
  )
}

function SecuredNodeView({
  name,
  kind,
  breadcrumb,
  code,
  tenantId,
  initialAccessCode,
}: {
  name: string
  kind: 'location' | 'group'
  breadcrumb: ScanBreadcrumbStep[]
  code: string
  tenantId?: string
  initialAccessCode?: string
}) {
  const [unlockedDetails, setUnlockedDetails] = useState<SecuredScanUnlock | null>(null)

  return (
    <div className="space-y-4">
      <BreadcrumbBar steps={breadcrumb} tenantId={tenantId} />
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <div className="text-5xl mb-3" aria-hidden="true">{"🔒"}</div>
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
          {kind === 'location' ? 'Service location' : 'Group'}
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">{name}</h2>
        <p className="text-sm text-slate-500 mb-6">This area is secured</p>
        <p className="text-sm text-slate-600 mb-6">
          To view what's here, request access from the owner. They'll review
          your request and reach out.
        </p>
        <AccessCodeUnlock code={code} tenantId={tenantId} initialAccessCode={initialAccessCode} onUnlocked={setUnlockedDetails} />
        {!unlockedDetails && <RequestAccessForm code={code} tenantId={tenantId} />}
      </div>
    </div>
  )
}

// ---------- Shared building blocks ----------

function BreadcrumbBar({
  steps,
  tenantId,
}: {
  steps: ScanBreadcrumbStep[]
  tenantId?: string
}) {
  if (!steps || steps.length === 0) return null
  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-600 break-words"
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const sep = i > 0 ? <span className="mx-1.5 text-slate-300">{'›'}</span> : null
        const canLink = !!tenantId && !!step.code && step.type !== 'customer'
        return (
          <span key={`${step.type}-${i}`}>
            {sep}
            {canLink ? (
              <Link
                to={`/scan/${tenantId}/${encodeURIComponent(step.code!)}`}
                className="text-amber-700 hover:underline"
              >
                {step.name}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-900 font-medium' : ''}>
                {step.name}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function AssetSelectionDetails({
  selectedAsset,
  tenantId,
  scannedAssetId,
}: {
  selectedAsset: ScanChildEntry | null
  tenantId?: string
  scannedAssetId?: string
}) {
  const [loadedAsset, setLoadedAsset] = useState<ScanChildEntry | null>(selectedAsset)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)

    if (!selectedAsset) {
      setLoadedAsset(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoadedAsset(selectedAsset)
    if (!tenantId || !selectedAsset.code) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    getPublicScan(selectedAsset.code, tenantId)
      .then((node) => {
        if (cancelled) return
        if (node.type !== 'asset') {
          setError('That QR code did not return an asset record.')
          return
        }
        if (node.is_secured) {
          setLoadedAsset({ ...selectedAsset, is_secured: true })
          return
        }
        setLoadedAsset(entryFromAssetDetail(selectedAsset, node))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load this asset record.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedAsset?.id, selectedAsset?.code, tenantId])

  if (!selectedAsset) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-sm text-slate-500 lg:sticky lg:top-4 lg:self-start">
        Select an asset in the tree to see its public record. Secured assets can request owner access from this panel.
      </div>
    )
  }

  return (
    <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Loading the latest public record for {selectedAsset.name}...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}
      {loadedAsset && (
        <PublicTreeAssetSummary
          asset={loadedAsset}
          isScannedAsset={loadedAsset.id === scannedAssetId}
          tenantId={tenantId}
        />
      )}
    </div>
  )
}

function entryFromAssetDetail(summary: ScanChildEntry, detail: PublicScanAssetOpen): ScanChildEntry {
  return {
    ...summary,
    id: detail.id,
    name: detail.name,
    is_secured: false,
    asset_type_name: detail.asset_type_name ?? summary.asset_type_name,
    tag: detail.tag ?? summary.tag,
    path: detail.breadcrumb ? pathFromBreadcrumb(detail.breadcrumb) : summary.path,
    physical: detail.physical,
    documents: detail.documents ?? [],
    photos: detail.photos ?? [],
    report: detail.report,
    service_log: detail.service_log,
    parts: detail.parts,
    coverage: detail.coverage,
    last_serviced_at: detail.last_serviced_at,
    open_priority: detail.open_priority,
  }
}

function labelize(value?: string | null): string {
  if (!value) return ''
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function isPdfDocument(document: PublicScanDocumentSummary): boolean {
  return document.mime_type === 'application/pdf' || (document.original_filename ?? '').toLowerCase().endsWith('.pdf')
}

function isImageDocument(document: PublicScanDocumentSummary): boolean {
  return !!document.mime_type?.startsWith('image/')
}

function formatShortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatBytes(value?: number | null): string {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

type AssetReportPrintSection = {
  title: string
  rows: Array<[string, string]>
}

function openAssetReportPrintWindow({
  title,
  subtitle,
  generatedAt,
  warnings,
  sections,
  documents,
  photos,
}: {
  title: string
  subtitle: string
  generatedAt: string
  warnings: string[]
  sections: AssetReportPrintSection[]
  documents: PublicScanDocumentSummary[]
  photos: PublicScanPhotoSummary[]
}) {
  const popup = window.open('', '_blank', 'width=1100,height=800')
  if (!popup) {
    window.print()
    return
  }

  const warningHtml = warnings.length > 0
    ? `<section class="warnings"><h2>Warnings</h2><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></section>`
    : ''
  const sectionHtml = sections.map((section) => `
    <section class="card">
      <h2>${escapeHtml(section.title)}</h2>
      <dl>${section.rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || 'Not captured')}</dd></div>`).join('')}</dl>
    </section>
  `).join('')
  const photoHtml = photos.length > 0
    ? `<section class="card wide"><h2>Photos</h2><div class="photos">${photos.map((photo) => `
        <figure>
          <img src="${escapeAttribute(photo.full_url || photo.medium_url || photo.thumb_url || '')}" alt="${escapeAttribute(photo.caption || photo.original_filename || 'Asset photo')}" />
          <figcaption>${escapeHtml(photo.caption || photo.original_filename || 'Asset photo')}${photo.created_at ? ` - ${escapeHtml(formatShortDate(photo.created_at))}` : ''}</figcaption>
        </figure>
      `).join('')}</div></section>`
    : ''
  const documentHtml = documents.length > 0
    ? `<section class="card wide"><h2>Documents and forms</h2><table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>URL</th></tr></thead><tbody>${documents.map((document) => `
      <tr>
        <td>${escapeHtml(document.title || document.original_filename || 'Document')}</td>
        <td>${escapeHtml(document.document_type || document.mime_type || 'File')}</td>
        <td>${escapeHtml(document.signed_at ? 'Signed' : document.signature_count > 0 ? `${document.signature_count} signature tags` : 'Attached')}</td>
        <td>${document.file_url ? `<a href="${escapeAttribute(document.file_url)}">Open file</a>` : 'No public URL'}</td>
      </tr>
    `).join('')}</tbody></table></section>`
    : ''

  popup.document.open()
  popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f7fb; color: #0f172a; font-family: Inter, Arial, sans-serif; line-height: 1.45; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px; }
    header { border-bottom: 3px solid #f59e0b; margin-bottom: 22px; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 15px; }
    .meta { margin: 8px 0 0; color: #64748b; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .card, .warnings { background: #fff; border: 1px solid #d9e2ef; border-radius: 10px; padding: 18px; break-inside: avoid; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
    .wide { grid-column: 1 / -1; }
    .warnings { margin-bottom: 14px; background: #fff7ed; border-color: #fed7aa; color: #7c2d12; }
    .warnings ul { margin: 0; padding-left: 18px; }
    dl { margin: 0; }
    dl div { display: grid; grid-template-columns: 150px 1fr; gap: 14px; padding: 7px 0; border-bottom: 1px solid #edf2f7; }
    dl div:last-child { border-bottom: 0; }
    dt { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
    dd { margin: 0; color: #1e293b; font-size: 13px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #edf2f7; padding: 9px 8px; text-align: left; vertical-align: top; }
    th { color: #64748b; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
    a { color: #b45309; }
    .photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    figure { margin: 0; }
    img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border: 1px solid #d9e2ef; border-radius: 8px; }
    figcaption { margin-top: 6px; color: #64748b; font-size: 12px; }
    footer { margin-top: 20px; border-top: 1px solid #d9e2ef; padding-top: 12px; color: #64748b; font-size: 12px; text-align: center; }
    @media print {
      body { background: #fff; }
      main { padding: 18px; max-width: none; }
      .card, .warnings { box-shadow: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(subtitle)}</p>
      <p class="meta">Generated ${escapeHtml(generatedAt)} by CrewBarn</p>
    </header>
    ${warningHtml}
    <div class="grid">${sectionHtml}${photoHtml}${documentHtml}</div>
    <footer>CrewBarn asset report</footer>
  </main>
</body>
</html>`)
  popup.document.close()
  popup.focus()
  window.setTimeout(() => popup.print(), 300)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value)
}
/**
 * What a group is, in one line.
 *
 * "12 assets" tells a building manager what they can already see. How many
 * have been looked at lately and how many are waiting on somebody is why
 * they scanned the label in the lobby.
 */
function formatGroupSubtitle(entry: ScanChildEntry): string {
  const parts: string[] = []
  const c = entry.counts
  if (c) {
    if (c.child_groups > 0) parts.push(`${c.child_groups} sub-group${c.child_groups === 1 ? '' : 's'}`)
    if (c.assets > 0) parts.push(`${c.assets} item${c.assets === 1 ? '' : 's'}`)
    if (c.serviced) parts.push(`${c.serviced} serviced recently`)
    if (c.attention) parts.push(`${c.attention} need${c.attention === 1 ? 's' : ''} attention`)
  }
  return parts.join(' · ') || 'Empty group'
}

function findFirstAsset(entries: ScanChildEntry[]): ScanChildEntry | null {
  for (const entry of entries) {
    if (entry.type === 'asset') return entry
    const childAsset = entry.children ? findFirstAsset(entry.children) : null
    if (childAsset) return childAsset
  }
  return null
}

function pathFromBreadcrumb(steps?: ScanBreadcrumbStep[]): string[] {
  return (steps ?? [])
    .filter((step) => step.type === 'location' || step.type === 'group')
    .map((step) => step.name)
}

function formatAddress(addr: PublicScanLocationOpen['address']): string {
  const parts = [addr.street_address, addr.city, addr.state, addr.postal_code].filter(Boolean)
  return parts.join(', ')
}

// ---------- Common UI atoms ----------

function Row({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 flex-shrink-0">{label}</dt>
      <dd className={`text-slate-900 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

// Slice 9 secured flow: request owner approval, or unlock with the one-time
// access code issued from the owner review queue.
function AccessCodeUnlock({
  code,
  tenantId,
  initialAccessCode = '',
  onUnlocked,
}: {
  code: string
  tenantId?: string
  initialAccessCode?: string
  onUnlocked?: (unlocked: SecuredScanUnlock) => void
}) {
  const [accessCode, setAccessCode] = useState(initialAccessCode)
  const [unlocked, setUnlocked] = useState<SecuredScanUnlock | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = accessCode.trim().length > 0 && !submitting
  const submit = async () => {
    if (!tenantId || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await unlockSecuredScan(tenantId, code, accessCode.trim())
      setUnlocked(result)
      onUnlocked?.(result)
    } catch (e) {
      setError((e as Error).message || 'Could not unlock this item.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!tenantId || !initialAccessCode.trim() || unlocked || submitting) return
    void submit()
  }, [tenantId, initialAccessCode])

  if (!tenantId) return null

  if (unlocked) {
    return <SecuredDetailsCard unlocked={unlocked} />
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
      <h3 className="text-sm font-semibold text-slate-900">Have an access code?</h3>
      <p className="mt-1 text-xs text-slate-500">Enter the one-time code the owner gave you.</p>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          inputMode="numeric"
          placeholder="Access code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300"
        >
          {submitting ? 'Checking...' : 'Unlock'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function SecuredDetailsCard({ unlocked }: { unlocked: SecuredScanUnlock }) {
  return (
    <div className="mb-4 space-y-4 text-left">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Owner-approved access</p>
        <h3 className="mt-1 text-lg font-semibold text-emerald-950">Secured details unlocked</h3>
        {unlocked.access_expires_at && (
          <p className="mt-2 text-sm text-emerald-800">
            Access expires {new Date(unlocked.access_expires_at).toLocaleString()}.
          </p>
        )}
        <p className="mt-2 text-sm text-emerald-800">
          You can view the approved asset report, owner-approved files, and any secured notes for this visit.
        </p>
      </div>
      <ApprovedTreeScopeCard unlocked={unlocked} />
      {unlocked.asset_report && <ApprovedAssetReport unlocked={unlocked} />}
      <SecuredDataCard value={unlocked.secured_data} />
    </div>
  )
}

function ApprovedTreeScopeCard({ unlocked }: { unlocked: SecuredScanUnlock }) {
  const tree = unlocked.asset_tree ?? []

  if (unlocked.access_scope !== 'tree' || tree.length === 0) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Full tree access approved</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">Related asset tree</h3>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
          {tree.length} top level
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        This code is approved for the related asset tree until it expires. Open another QR sticker or asset code in this tree
        and enter the same code to unlock that secured item.
      </p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
        {tree.map((entry) => (
          <ApprovedTreeScopeNode
            key={entry.id}
            depth={0}
            entry={entry}
            selectedAssetId={unlocked.selected_asset_id ?? unlocked.id}
          />
        ))}
      </div>
    </div>
  )
}

function ApprovedTreeScopeNode({
  entry,
  selectedAssetId,
  depth,
}: {
  entry: ScanChildEntry
  selectedAssetId?: string | null
  depth: number
}) {
  const children = entry.children ?? []
  const isCurrent = entry.type === 'asset' && entry.id === selectedAssetId
  const subtitle =
    entry.type === 'group'
      ? [
          `${entry.counts?.assets ?? 0} item${entry.counts?.assets === 1 ? '' : 's'}`,
          entry.counts?.attention
            ? `${entry.counts.attention} need${entry.counts.attention === 1 ? 's' : ''} attention`
            : null,
          children.length > 0 ? `${children.length} nested` : null,
        ].filter(Boolean).join(' - ')
      : [entry.asset_type_name, entry.code].filter(Boolean).join(' - ') || 'Asset'

  return (
    <div className="space-y-2">
      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          isCurrent ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
        }`}
        style={{ marginLeft: depth * 14 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{entry.name}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {isCurrent && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Current</span>
            )}
            {entry.type === 'group' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Group</span>
            )}
            {entry.is_secured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Secured</span>
            )}
          </div>
        </div>
      </div>
      {children.map((child) => (
        <ApprovedTreeScopeNode key={child.id} depth={depth + 1} entry={child} selectedAssetId={selectedAssetId} />
      ))}
    </div>
  )
}
function ApprovedAssetReport({ unlocked }: { unlocked: SecuredScanUnlock }) {
  const report = unlocked.asset_report
  if (!report) return null

  const warnings = report.report?.warnings ?? []
  const docs = report.documents ?? []
  const photos = report.photos ?? []
  const path = report.path ?? []
  const history = report.report?.history
  const historyEvents = history?.recent_events ?? []
  const requiredForms = report.report?.required_forms ?? []
  const reportGeneratedAt = new Date().toLocaleString()
  const approvedReportSections: AssetReportPrintSection[] = [
    {
      title: 'Asset / equipment',
      rows: [
        ['Asset', unlocked.name],
        ['Type', report.asset_type_name || 'Not captured'],
        ['Manufacturer', report.physical?.manufacturer || 'Not captured'],
        ['Model', report.physical?.model || 'Not captured'],
        ['Serial', report.physical?.serial_number || 'Not captured'],
        ['Installed', report.physical?.install_date || 'Not captured'],
      ],
    },
    {
      title: 'Location / history',
      rows: [
        ['Path', path.length > 0 ? path.join(' > ') : 'Not grouped'],
        ['Inspection cadence', labelize(report.report?.inspection_cadence) || 'Not captured'],
        ['Next due', report.report?.next_due_at || 'Not scheduled'],
        ['Inventory parts', `${history?.inventory_count ?? 0} linked`],
        ['Required forms', requiredForms.length > 0 ? requiredForms.map((form) => form.name).join(', ') : 'None configured'],
      ],
    },
    ...(historyEvents.length > 0 ? [{
      title: 'Recent asset history',
      rows: historyEvents.slice(0, 8).map((event) => [
        [event.label || labelize(event.type), event.reference].filter(Boolean).join(' '),
        [event.title, event.status ? labelize(event.status) : '', event.date ? formatShortDate(event.date) : ''].filter(Boolean).join(' - '),
      ] as [string, string]),
    }] : []),
    {
      title: 'Approved files',
      rows: [
        ['Documents', docs.length > 0 ? `${docs.length} approved` : 'None approved'],
        ['Photos', photos.length > 0 ? `${photos.length} approved` : 'None approved'],
        ['Signed documents', docs.filter((document) => !!document.signed_at || document.signature_count > 0).length > 0 ? 'Included' : 'None attached'],
        ['Required forms', requiredForms.length > 0 ? requiredForms.map((form) => form.name).join(', ') : 'None configured'],
      ],
    },
  ]
  const printReport = () => openAssetReportPrintWindow({
    title: `${unlocked.name} approved asset report`,
    subtitle: 'Owner-approved asset report for this visit. It includes approved secured files and visible asset details.',
    generatedAt: reportGeneratedAt,
    warnings,
    sections: approvedReportSections,
    documents: docs,
    photos,
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved asset report</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{unlocked.name}</h3>
          <p className="mt-2 text-sm text-slate-600">
            Owner-approved view for this visit. Public fields, secured notes, and approved secured files are shown together here.
          </p>
          <button
            type="button"
            onClick={printReport}
            className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print approved report / save PDF
          </button>
        </div>
        {warnings.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Warnings</h4>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}
        <div className="grid gap-4 p-5 lg:grid-cols-2 sm:p-6">
          <ReportFactCard
            title="Asset / equipment"
            rows={[
              ['Asset', unlocked.name],
              ['Type', report.asset_type_name || 'Not captured'],
              ['Manufacturer', report.physical?.manufacturer || 'Not captured'],
              ['Model', report.physical?.model || 'Not captured'],
              ['Serial', report.physical?.serial_number || 'Not captured'],
              ['Installed', report.physical?.install_date || 'Not captured'],
            ]}
          />
          <ReportFactCard
            title="Location / history"
            rows={[
              ['Path', path.length > 0 ? path.join(' > ') : 'Not grouped'],
              ['Inspection cadence', labelize(report.report?.inspection_cadence) || 'Not captured'],
              ['Next due', report.report?.next_due_at || 'Not scheduled'],
              ['Inspections', `${history?.inspection_count ?? 0}`],
              ['Inventory changes', `${history?.inventory_count ?? 0}`],
            ]}
          />
          <AssetHistoryEventsCard events={historyEvents} />
          <RequiredFormsCard forms={requiredForms} title="Required forms / checklists" />
          <ReportFactCard
            title="Approved files"
            rows={[
              ['Documents', `${docs.length}`],
              ['Viewable files', `${docs.filter((document) => !!document.file_url).length}`],
              ['Signed docs', `${docs.filter((document) => !!document.signed_at || document.signature_count > 0).length}`],
              ['Photos', `${photos.length}`],
            ]}
          />
        </div>
      </div>

      <PublicAssetPhotosCard photos={photos} />
      <PublicAssetDocumentsCard
        documents={docs}
        title="Approved documents"
        description="Open owner-approved manuals, reports, signed forms, and secured files for this asset."
        emptyText="No approved documents are attached."
        noFilesText="Approved documents are listed, but no viewable files are attached yet."
      />
      <PrintableDocumentLinks documents={docs} title="Approved report file links" description="Owner-approved document URLs attached to this secured asset report." />
    </div>
  )
}

function SecuredDataCard({ value }: { value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secured notes / sensitive fields</p>
      <SecuredPayloadView value={value} />
    </div>
  )
}

function SecuredPayloadView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <p className="mt-3 text-sm text-slate-600">No secured notes are saved for this item.</p>
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{String(value)}</p>
  }
  if (Array.isArray(value)) {
    return (
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
        {value.map((item, index) => <li key={index}>{String(item)}</li>)}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return (
      <dl className="mt-3 space-y-2 text-sm">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="rounded-md bg-white/70 p-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-800">{String(item ?? '')}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return null
}
function RequestAccessForm({
  code,
  tenantId,
  servicerName,
  offerWholeSite,
}: {
  code: string
  tenantId?: string
  servicerName?: string | null
  /** Shown when the asset sits in a property, so an AHJ can ask once. */
  offerWholeSite?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wholeSite, setWholeSite] = useState(false)

  // Only reachable now if the server couldn't resolve a tenant at all. Name
  // whoever we do know about rather than telling someone to contact an owner
  // we never identified.
  if (!tenantId) {
    return (
      <p className="text-xs text-slate-500">
        {servicerName
          ? `Contact ${servicerName} to request access to this item.`
          : 'Access to this item has to be arranged with the company that services it.'}
      </p>
    )
  }

  if (done) {
    return (
      <div className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-4">
        ✓ Request sent. The owner has been notified and will reach out.
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-sm px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
      >
        {"📋"} Request access
      </button>
    )
  }

  const canSubmit = name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0) && !submitting

  const submit = async () => {
    if (!tenantId || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await submitAccessRequest(tenantId, code, {
        requester_name: name.trim(),
        requester_email: email.trim() || undefined,
        requester_phone: phone.trim() || undefined,
        message: message.trim() || undefined,
        access_scope: wholeSite ? 'tree' : 'item',
      })
      setDone(true)
    } catch (e) {
      setError((e as Error).message || 'Could not send the request.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500'

  return (
    <div className="text-left space-y-3">
      <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={inputCls} type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <textarea className={inputCls} placeholder="Why do you need access? (optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      <p className="text-[11px] text-slate-400">Add at least an email or phone so the owner can respond.</p>

      {/* The scope was approvable from day one but never askable: the public
          endpoint hardcoded item scope, so a fire marshal walking a building
          filed one request per item. */}
      {offerWholeSite && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={wholeSite}
            onChange={(e) => setWholeSite(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
          />
          <span className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">
              I'm an inspector — I need the whole property
            </span>
            <br />
            Asks once for every asset at this site instead of one request per item. The owner still
            decides what to grant.
          </span>
        </label>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full text-sm px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-md font-medium transition-colors"
      >
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </div>
  )
}
