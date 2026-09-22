import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'

type AccountingAccount = {
  id: string
  code: string
  name: string
  account_type: string
  normal_balance: string
  is_cash_account: boolean
  is_system: boolean
  active: boolean
}

type TrialBalanceRow = AccountingAccount & {
  balance_debit_cents: number
  balance_credit_cents: number
  activity_debit_cents: number
  activity_credit_cents: number
}

type StatementRow = AccountingAccount & {
  debit_cents: number
  credit_cents: number
  balance_cents: number
}

type IncomeStatementReport = {
  from: string
  to: string
  sections: {
    revenue: StatementRow[]
    contra_revenue: StatementRow[]
    expenses: StatementRow[]
  }
  totals: {
    gross_revenue_cents: number
    discounts_cents: number
    net_revenue_cents: number
    expenses_cents: number
    net_income_cents: number
  }
}

type BalanceSheetReport = {
  as_of: string
  sections: {
    assets: StatementRow[]
    liabilities: StatementRow[]
    equity: StatementRow[]
  }
  totals: {
    assets_cents: number
    liabilities_cents: number
    equity_cents: number
    current_earnings_cents: number
    liabilities_and_equity_cents: number
    is_balanced: boolean
  }
}

type CashFlowRow = {
  label: string
  amount_cents: number
  kind: string
  account_code?: string
  account_name?: string
}

type CashFlowStatementReport = {
  from: string
  to: string
  sections: {
    operating: CashFlowRow[]
    investing: CashFlowRow[]
    financing: CashFlowRow[]
  }
  totals: {
    beginning_cash_cents: number
    operating_cash_cents: number
    investing_cash_cents: number
    financing_cash_cents: number
    net_cash_change_cents: number
    calculated_cash_change_cents: number
    ending_cash_cents: number
    is_reconciled: boolean
  }
}

type JournalLine = {
  id: string
  account: AccountingAccount | null
  debit_cents: number
  credit_cents: number
  memo: string | null
}

type JournalEntry = {
  id: string
  entry_date: string | null
  entry_number: string | null
  status: string
  basis: string
  source_type: string | null
  source_id: string | null
  memo: string | null
  reason: string | null
  lines: JournalLine[]
  created_at: string | null
}

type YearEndCloseResponse = {
  data: JournalEntry
  duplicate?: boolean
  totals?: {
    year: number
    closed_from: string
    closed_to: string
    retained_earnings_account_code: string
    net_income_cents: number
  }
}

type OwnerDrawResponse = {
  data: JournalEntry
  duplicate?: boolean
}

type SalesTaxPaymentResponse = {
  data: JournalEntry
  duplicate?: boolean
}

type GlDetailLine = {
  id: string
  entry_id: string
  entry_date: string | null
  entry_number: string | null
  entry_status: string | null
  basis: string | null
  account: AccountingAccount | null
  debit_cents: number
  credit_cents: number
  source_type: string | null
  source_id: string | null
  memo: string | null
  created_at: string | null
}

type PostingAuditRow = {
  id: string
  record_type: string
  source_type: string
  source_id: string
  reference: string | null
  record_date: string | null
  status: string | null
  amount_cents: number
  reason: string
}

type PostingAuditReport = {
  from: string
  to: string
  total_count: number
  total_amount_cents: number
  rows: PostingAuditRow[]
  truncated: boolean
}

type AccountingPeriod = {
  id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  status: 'open' | 'closed' | 'locked' | string
  journal_entries_count: number
  closed_at: string | null
  closed_by: { id: string; name: string; email: string } | null
  close_notes: string | null
  created_at: string | null
}

type JournalFormLine = {
  account_code: string
  debit: string
  credit: string
  memo: string
}

type LedgerExportKind = 'trial' | 'gl' | 'journal' | 'income' | 'balance' | 'cash-flow' | 'posting-audit'

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

async function downloadAccountingCsv(path: string, fallbackFilename: string) {
  const headers: Record<string, string> = {
    Accept: fallbackFilename.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
  }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
  const franchiseActAs = getFranchiseActAs()
  if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    let message = `Could not download ${fallbackFilename}. Server returned HTTP ${response.status}.`
    try {
      const contentType = response.headers.get('Content-Type') ?? ''
      if (contentType.includes('application/json')) {
        const body = await response.json()
        const serverMessage = typeof body?.message === 'string'
          ? body.message
          : typeof body?.error === 'string'
            ? body.error
            : null
        if (serverMessage && serverMessage !== 'Server Error') {
          message = serverMessage
        }
      } else {
        const body = await response.text()
        const text = body.trim()
        if (text && text !== 'Server Error' && !text.startsWith('<')) {
          message = text.slice(0, 500)
        }
      }
    } catch {
      // Keep the HTTP status message when the export body cannot be read.
    }

    throw new Error(message)
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFilename
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function centsFromInput(value: string): number {
  return Math.round(Number(value || 0) * 100)
}

function blankLine(): JournalFormLine {
  return { account_code: '', debit: '', credit: '', memo: '' }
}

export function GeneralLedgerPage() {
  const queryClient = useQueryClient()
  const tenantTimezone = useTenantTimezone()
  const today = tenantDate(tenantTimezone)
  const priorYear = String(Number(today.slice(0, 4)) - 1)
  const [asOf, setAsOf] = useState(today)
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [sourceType, setSourceType] = useState('')
  const [journalPage, setJournalPage] = useState(1)
  const [detailAccountCode, setDetailAccountCode] = useState('')
  const [detailStatus, setDetailStatus] = useState('posted')
  const [detailPerPage, setDetailPerPage] = useState('50')
  const [detailPage, setDetailPage] = useState(1)
  const [exporting, setExporting] = useState<LedgerExportKind | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [entryDate, setEntryDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<JournalFormLine[]>([blankLine(), blankLine()])
  const [journalValidationError, setJournalValidationError] = useState('')
  const [yearEndCloseYear, setYearEndCloseYear] = useState(priorYear)
  const [yearEndRetainedCode, setYearEndRetainedCode] = useState('3020')
  const [yearEndCloseMessage, setYearEndCloseMessage] = useState('')
  const [yearEndCloseError, setYearEndCloseError] = useState('')
  const [ownerDrawForm, setOwnerDrawForm] = useState({
    draw_on: today,
    amount: '',
    owner_name: '',
    reference_number: '',
    memo: '',
    cash_account_code: '1010',
  })
  const [ownerDrawMessage, setOwnerDrawMessage] = useState('')
  const [ownerDrawError, setOwnerDrawError] = useState('')
  const [salesTaxPaymentForm, setSalesTaxPaymentForm] = useState({
    paid_on: today,
    amount: '',
    from: today.slice(0, 8) + '01',
    to: today,
    reference_number: '',
    memo: '',
    cash_account_code: '1010',
  })
  const [salesTaxPaymentMessage, setSalesTaxPaymentMessage] = useState('')
  const [salesTaxPaymentError, setSalesTaxPaymentError] = useState('')
  const [periodFrom, setPeriodFrom] = useState(today.slice(0, 8) + '01')
  const [periodTo, setPeriodTo] = useState(today)
  const [periodNotes, setPeriodNotes] = useState('')
  const [periodActionId, setPeriodActionId] = useState<string | null>(null)

  useEffect(() => {
    const monthStart = today.slice(0, 8) + '01'
    setAsOf(today)
    setFrom(monthStart)
    setTo(today)
    setEntryDate(today)
    setYearEndCloseYear(priorYear)
    setOwnerDrawForm((current) => ({ ...current, draw_on: today }))
    setSalesTaxPaymentForm((current) => ({ ...current, paid_on: today, from: monthStart, to: today }))
    setPeriodFrom(monthStart)
    setPeriodTo(today)
  }, [priorYear, today])

  const accountsQ = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => apiRequest<{ data: AccountingAccount[] }>('/v1/accounting/accounts?active=1'),
    staleTime: 300_000,
  })

  const trialBalanceQ = useQuery({
    queryKey: ['accounting', 'trial-balance', asOf],
    queryFn: () => apiRequest<{ data: { rows: TrialBalanceRow[]; totals: { debit_cents: number; credit_cents: number; is_balanced: boolean } } }>(
      `/v1/accounting/trial-balance?as_of=${encodeURIComponent(asOf)}`,
    ),
    staleTime: 60_000,
  })

  const incomeStatementQ = useQuery({
    queryKey: ['accounting', 'income-statement', from, to],
    queryFn: () => apiRequest<{ data: IncomeStatementReport }>(
      `/v1/accounting/income-statement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    staleTime: 60_000,
  })

  const balanceSheetQ = useQuery({
    queryKey: ['accounting', 'balance-sheet', asOf],
    queryFn: () => apiRequest<{ data: BalanceSheetReport }>(
      `/v1/accounting/balance-sheet?as_of=${encodeURIComponent(asOf)}`,
    ),
    staleTime: 60_000,
  })

  const cashFlowStatementQ = useQuery({
    queryKey: ['accounting', 'cash-flow-statement', from, to],
    queryFn: () => apiRequest<{ data: CashFlowStatementReport }>(
      `/v1/accounting/cash-flow-statement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    staleTime: 60_000,
  })

  const journalParams = new URLSearchParams({ from, to, per_page: '25', page: String(journalPage) })
  if (sourceType.trim()) journalParams.set('source_type', sourceType.trim())
  const journalsQ = useQuery({
    queryKey: ['accounting', 'journal-entries', from, to, sourceType, journalPage],
    queryFn: () => apiRequest<{ data: { data: JournalEntry[]; total: number; current_page: number; last_page: number } }>(
      `/v1/accounting/journal-entries?${journalParams.toString()}`,
    ),
    staleTime: 30_000,
  })

  const detailParams = new URLSearchParams({ from, to, per_page: detailPerPage, status: detailStatus, page: String(detailPage) })
  if (sourceType.trim()) detailParams.set('source_type', sourceType.trim())
  if (detailAccountCode.trim()) detailParams.set('account_code', detailAccountCode.trim())
  const glDetailQ = useQuery({
    queryKey: ['accounting', 'gl-detail', from, to, sourceType, detailAccountCode, detailStatus, detailPerPage, detailPage],
    queryFn: () => apiRequest<{ data: { data: GlDetailLine[]; total: number; current_page: number; last_page: number; per_page: number } }>(
      `/v1/accounting/gl-detail?${detailParams.toString()}`,
    ),
    staleTime: 30_000,
  })

  const postingAuditQ = useQuery({
    queryKey: ['accounting', 'posting-audit', from, to],
    queryFn: () => apiRequest<{ data: PostingAuditReport }>(
      `/v1/accounting/posting-audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    staleTime: 30_000,
  })

  const periodParams = new URLSearchParams({ from: periodFrom, to: periodTo })
  const periodsQ = useQuery({
    queryKey: ['accounting', 'periods', periodFrom, periodTo],
    queryFn: () => apiRequest<{ data: AccountingPeriod[] }>(`/v1/accounting/periods?${periodParams.toString()}`),
    staleTime: 30_000,
  })

  const seedMutation = useMutation({
    mutationFn: () => apiRequest<{ data: { created_count: number } }>('/v1/accounting/accounts/seed-defaults', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const journalMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ data: JournalEntry }>('/v1/accounting/journal-entries', {
        method: 'POST',
        body: {
          entry_date: entryDate,
          basis: 'accrual',
          memo: memo.trim() || 'Manual journal entry',
          reason: reason.trim() || undefined,
          lines: lines
            .filter((line) => line.account_code || line.debit || line.credit)
            .map((line) => ({
              account_code: line.account_code,
              debit_cents: centsFromInput(line.debit),
              credit_cents: centsFromInput(line.credit),
              memo: line.memo.trim() || undefined,
            })),
        },
      }),
    onSuccess: () => {
      setMemo('')
      setReason('')
      setLines([blankLine(), blankLine()])
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const yearEndCloseMutation = useMutation({
    mutationFn: () =>
      apiRequest<YearEndCloseResponse>('/v1/accounting/year-end-close', {
        method: 'POST',
        body: {
          year: Number(yearEndCloseYear),
          retained_earnings_account_code: yearEndRetainedCode || '3020',
        },
      }),
    onSuccess: (response) => {
      const netIncome = response.totals?.net_income_cents ?? 0
      const closedYear = response.totals?.year ?? Number(yearEndCloseYear)
      setYearEndCloseMessage(
        response.duplicate
          ? `Year ${closedYear} was already closed.`
          : `Year ${closedYear} closed. Net income moved: ${money(netIncome)}.`,
      )
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const ownerDrawMutation = useMutation({
    mutationFn: () =>
      apiRequest<OwnerDrawResponse>('/v1/accounting/owner-draws', {
        method: 'POST',
        body: {
          draw_on: ownerDrawForm.draw_on,
          amount_cents: centsFromInput(ownerDrawForm.amount),
          owner_name: ownerDrawForm.owner_name.trim() || undefined,
          reference_number: ownerDrawForm.reference_number.trim() || undefined,
          memo: ownerDrawForm.memo.trim() || undefined,
          cash_account_code: ownerDrawForm.cash_account_code,
        },
      }),
    onSuccess: (response) => {
      setOwnerDrawMessage(response.duplicate ? 'Owner draw was already posted.' : 'Owner draw posted.')
      setOwnerDrawForm((current) => ({
        ...current,
        amount: '',
        reference_number: '',
        memo: '',
      }))
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const salesTaxPaymentMutation = useMutation({
    mutationFn: () =>
      apiRequest<SalesTaxPaymentResponse>('/v1/accounting/sales-tax-payments', {
        method: 'POST',
        body: {
          paid_on: salesTaxPaymentForm.paid_on,
          amount_cents: centsFromInput(salesTaxPaymentForm.amount),
          from: salesTaxPaymentForm.from || undefined,
          to: salesTaxPaymentForm.to || undefined,
          reference_number: salesTaxPaymentForm.reference_number.trim() || undefined,
          memo: salesTaxPaymentForm.memo.trim() || undefined,
          cash_account_code: salesTaxPaymentForm.cash_account_code,
        },
      }),
    onSuccess: (response) => {
      setSalesTaxPaymentMessage(response.duplicate ? 'Sales tax payment was already posted.' : 'Sales tax payment posted.')
      setSalesTaxPaymentForm((current) => ({
        ...current,
        amount: '',
        reference_number: '',
        memo: '',
      }))
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const closePeriodMutation = useMutation({
    mutationFn: ({ periodId, lock }: { periodId: string; lock: boolean }) =>
      apiRequest<{ data: AccountingPeriod }>(`/v1/accounting/periods/${encodeURIComponent(periodId)}/close`, {
        method: 'POST',
        body: {
          lock,
          close_notes: periodNotes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setPeriodNotes('')
      setPeriodActionId(null)
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
    onError: () => {
      setPeriodActionId(null)
    },
  })

  const reopenPeriodMutation = useMutation({
    mutationFn: (periodId: string) =>
      apiRequest<{ data: AccountingPeriod }>(`/v1/accounting/periods/${encodeURIComponent(periodId)}/reopen`, {
        method: 'POST',
        body: {
          close_notes: periodNotes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setPeriodNotes('')
      setPeriodActionId(null)
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
    onError: () => {
      setPeriodActionId(null)
    },
  })

  const accountOptions = accountsQ.data?.data ?? []
  const trialRows = trialBalanceQ.data?.data.rows ?? []
  const trialTotals = trialBalanceQ.data?.data.totals
  const incomeStatement = incomeStatementQ.data?.data
  const balanceSheet = balanceSheetQ.data?.data
  const cashFlowStatement = cashFlowStatementQ.data?.data
  const journalEntries = journalsQ.data?.data.data ?? []
  const journalCurrentPage = journalsQ.data?.data.current_page ?? 1
  const journalLastPage = journalsQ.data?.data.last_page ?? 1
  const journalTotal = journalsQ.data?.data.total ?? 0
  const detailLines = glDetailQ.data?.data.data ?? []
  const detailTotal = glDetailQ.data?.data.total ?? 0
  const detailCurrentPage = glDetailQ.data?.data.current_page ?? 1
  const detailLastPage = glDetailQ.data?.data.last_page ?? 1
  const postingAudit = postingAuditQ.data?.data
  const postingAuditRows = postingAudit?.rows ?? []
  const periods = periodsQ.data?.data ?? []
  const formDebit = useMemo(() => lines.reduce((sum, line) => sum + centsFromInput(line.debit), 0), [lines])
  const formCredit = useMemo(() => lines.reduce((sum, line) => sum + centsFromInput(line.credit), 0), [lines])
  const formBalanced = formDebit > 0 && formDebit === formCredit

  function updateLine(index: number, patch: Partial<JournalFormLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function submitJournal() {
    if (!formBalanced) {
      setJournalValidationError('Journal entry must balance before posting.')
      return
    }
    setJournalValidationError('')
    journalMutation.mutate()
  }

  function postYearEndClose() {
    const year = Number(yearEndCloseYear)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setYearEndCloseError('Enter a valid accounting year.')
      return
    }

    const ok = window.confirm(
      `Close ${year} revenue and expense accounts to retained earnings? This posts a journal entry dated 12/31/${year}.`,
    )
    if (!ok) return
    setYearEndCloseMessage('')
    setYearEndCloseError('')
    yearEndCloseMutation.mutate()
  }

  function submitOwnerDraw() {
    const amountCents = centsFromInput(ownerDrawForm.amount)
    if (amountCents <= 0) {
      setOwnerDrawError('Enter an owner draw amount.')
      return
    }

    const owner = ownerDrawForm.owner_name.trim() || 'Owner'
    const ok = window.confirm(`Post owner draw for ${owner} for ${money(amountCents)}?`)
    if (!ok) return

    setOwnerDrawMessage('')
    setOwnerDrawError('')
    ownerDrawMutation.mutate()
  }

  function submitSalesTaxPayment() {
    const amountCents = centsFromInput(salesTaxPaymentForm.amount)
    if (amountCents <= 0) {
      setSalesTaxPaymentError('Enter a sales tax payment amount.')
      return
    }

    if (salesTaxPaymentForm.from && salesTaxPaymentForm.to && salesTaxPaymentForm.to < salesTaxPaymentForm.from) {
      setSalesTaxPaymentError('Sales tax period end must be after the start date.')
      return
    }

    const ok = window.confirm(`Post sales tax payment for ${money(amountCents)}?`)
    if (!ok) return

    setSalesTaxPaymentMessage('')
    setSalesTaxPaymentError('')
    salesTaxPaymentMutation.mutate()
  }

  function closePeriod(periodId: string, lock: boolean) {
    setPeriodActionId(periodId)
    closePeriodMutation.mutate({ periodId, lock })
  }

  function reopenPeriod(periodId: string) {
    setPeriodActionId(periodId)
    reopenPeriodMutation.mutate(periodId)
  }

  function drillIntoAccount(accountCode: string) {
    setDetailAccountCode(accountCode)
    setDetailPage(1)
  }

  function updateRange(kind: 'from' | 'to', value: string) {
    if (kind === 'from') {
      setFrom(value)
    } else {
      setTo(value)
    }
    setJournalPage(1)
    setDetailPage(1)
  }

  function updateSourceFilter(value: string) {
    setSourceType(value)
    setJournalPage(1)
    setDetailPage(1)
  }

  function clearLedgerFilters() {
    setSourceType('')
    setDetailAccountCode('')
    setDetailStatus('posted')
    setDetailPerPage('50')
    setJournalPage(1)
    setDetailPage(1)
  }

  async function runLedgerExport(kind: LedgerExportKind, task: () => Promise<void>) {
    if (exporting) return
    setExportError(null)
    setExporting(kind)
    try {
      await task()
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not download accounting export.')
    } finally {
      setExporting(null)
    }
  }

  function exportLabel(kind: LedgerExportKind, label = 'Spreadsheet'): string {
    return exporting === kind ? 'Downloading...' : label
  }

  async function downloadTrialBalanceCsv() {
    await runLedgerExport('trial', async () => {
      const params = new URLSearchParams({ as_of: asOf, format: 'csv' })
      await downloadAccountingCsv(`/v1/accounting/trial-balance?${params.toString()}`, `trial-balance-${asOf}.csv`)
    })
  }

  async function downloadTrialBalancePdf() {
    await runLedgerExport('trial', async () => {
      const params = new URLSearchParams({ as_of: asOf, format: 'pdf' })
      await downloadAccountingCsv(`/v1/accounting/trial-balance?${params.toString()}`, `trial-balance-${asOf}.pdf`)
    })
  }

  async function downloadJournalCsv() {
    await runLedgerExport('journal', async () => {
      const params = new URLSearchParams({ from, to, format: 'csv' })
      if (sourceType) params.set('source_type', sourceType)
      await downloadAccountingCsv(`/v1/accounting/journal-entries?${params.toString()}`, `journal-entries-${from}-${to}.csv`)
    })
  }

  async function downloadJournalPdf() {
    await runLedgerExport('journal', async () => {
      const params = new URLSearchParams({ from, to, format: 'pdf' })
      if (sourceType) params.set('source_type', sourceType)
      await downloadAccountingCsv(`/v1/accounting/journal-entries?${params.toString()}`, `journal-entries-${from}-${to}.pdf`)
    })
  }

  async function downloadGlDetailCsv() {
    await runLedgerExport('gl', async () => {
      const params = new URLSearchParams({ from, to, status: detailStatus, format: 'csv' })
      if (sourceType) params.set('source_type', sourceType)
      if (detailAccountCode) params.set('account_code', detailAccountCode)
      await downloadAccountingCsv(`/v1/accounting/gl-detail?${params.toString()}`, `gl-detail-${from}-${to}.csv`)
    })
  }

  async function downloadGlDetailPdf() {
    await runLedgerExport('gl', async () => {
      const params = new URLSearchParams({ from, to, status: detailStatus, format: 'pdf' })
      if (sourceType) params.set('source_type', sourceType)
      if (detailAccountCode) params.set('account_code', detailAccountCode)
      await downloadAccountingCsv(`/v1/accounting/gl-detail?${params.toString()}`, `gl-detail-${from}-${to}.pdf`)
    })
  }

  async function downloadPostingAuditCsv() {
    await runLedgerExport('posting-audit', async () => {
      const params = new URLSearchParams({ from, to, format: 'csv' })
      await downloadAccountingCsv(`/v1/accounting/posting-audit?${params.toString()}`, `posting-audit-${from}-${to}.csv`)
    })
  }

  async function downloadPostingAuditPdf() {
    await runLedgerExport('posting-audit', async () => {
      const params = new URLSearchParams({ from, to, format: 'pdf' })
      await downloadAccountingCsv(`/v1/accounting/posting-audit?${params.toString()}`, `posting-audit-${from}-${to}.pdf`)
    })
  }

  async function downloadIncomeStatementCsv() {
    await runLedgerExport('income', async () => {
      const params = new URLSearchParams({ from, to, format: 'csv' })
      await downloadAccountingCsv(`/v1/accounting/income-statement?${params.toString()}`, `income-statement-${from}-${to}.csv`)
    })
  }

  async function downloadIncomeStatementPdf() {
    await runLedgerExport('income', async () => {
      const params = new URLSearchParams({ from, to, format: 'pdf' })
      await downloadAccountingCsv(`/v1/accounting/income-statement?${params.toString()}`, `income-statement-${from}-${to}.pdf`)
    })
  }

  async function downloadBalanceSheetCsv() {
    await runLedgerExport('balance', async () => {
      const params = new URLSearchParams({ as_of: asOf, format: 'csv' })
      await downloadAccountingCsv(`/v1/accounting/balance-sheet?${params.toString()}`, `balance-sheet-${asOf}.csv`)
    })
  }

  async function downloadBalanceSheetPdf() {
    await runLedgerExport('balance', async () => {
      const params = new URLSearchParams({ as_of: asOf, format: 'pdf' })
      await downloadAccountingCsv(`/v1/accounting/balance-sheet?${params.toString()}`, `balance-sheet-${asOf}.pdf`)
    })
  }

  async function downloadCashFlowStatementCsv() {
    await runLedgerExport('cash-flow', async () => {
      const params = new URLSearchParams({ from, to, format: 'csv' })
      await downloadAccountingCsv(`/v1/accounting/cash-flow-statement?${params.toString()}`, `cash-flow-statement-${from}-${to}.csv`)
    })
  }

  async function downloadCashFlowStatementPdf() {
    await runLedgerExport('cash-flow', async () => {
      const params = new URLSearchParams({ from, to, format: 'pdf' })
      await downloadAccountingCsv(`/v1/accounting/cash-flow-statement?${params.toString()}`, `cash-flow-statement-${from}-${to}.pdf`)
    })
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Accounting</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">General Ledger</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Chart of accounts, trial balance, posted journal entries, and bookkeeper adjustments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {seedMutation.isPending ? 'Seeding...' : 'Add missing starter accounts'}
          </button>
          <Link
            to="/accounting"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Accounting overview
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Ledger filters</h2>
            <p className="mt-1 text-sm text-slate-500">
              Date range controls income statement, GL detail, and journal entries. As-of controls trial balance and balance sheet.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[760px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => updateRange('from', event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => updateRange('to', event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">As of</span>
              <input
                type="date"
                value={asOf}
                onChange={(event) => setAsOf(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Source</span>
              <input
                value={sourceType}
                onChange={(event) => updateSourceFilter(event.target.value)}
                placeholder="invoice, payment, payroll"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sourceType.trim() ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              Source: {sourceType.trim()}
            </span>
          ) : null}
          {detailAccountCode ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              GL account: {detailAccountCode}
            </span>
          ) : null}
          {detailStatus !== 'posted' || detailPerPage !== '50' || sourceType.trim() || detailAccountCode ? (
            <button
              type="button"
              onClick={clearLedgerFilters}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear detail filters
            </button>
          ) : null}
        </div>
      </section>

      {exportError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
          {exportError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Trial balance debit" value={money(trialTotals?.debit_cents ?? 0)} />
        <Metric label="Trial balance credit" value={money(trialTotals?.credit_cents ?? 0)} />
        <Metric
          label="Balance status"
          value={trialTotals?.is_balanced ? 'Balanced' : 'Out of balance'}
          tone={trialTotals?.is_balanced === false ? 'red' : 'green'}
        />
        <Metric
          label="Net income"
          value={money(incomeStatement?.totals.net_income_cents ?? 0)}
          tone={(incomeStatement?.totals.net_income_cents ?? 0) < 0 ? 'red' : 'green'}
        />
        <Metric label="Assets" value={money(balanceSheet?.totals.assets_cents ?? 0)} />
        <Metric
          label="Balance sheet"
          value={balanceSheet?.totals.is_balanced ? 'Balanced' : 'Out of balance'}
          tone={balanceSheet?.totals.is_balanced === false ? 'red' : 'green'}
        />
        <Metric
          label="Cash change"
          value={money(cashFlowStatement?.totals.net_cash_change_cents ?? 0)}
          tone={(cashFlowStatement?.totals.net_cash_change_cents ?? 0) < 0 ? 'red' : 'green'}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Posting audit</h2>
            <p className="mt-1 text-sm text-slate-500">
              Checks invoices, payments, expenses, vendor bills, purchase receipts, payroll, write-offs, and refunds for missing posted GL entries.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPostingAuditPdf}
                disabled={exporting !== null}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportLabel('posting-audit', 'PDF')}
              </button>
              <button
                type="button"
                onClick={downloadPostingAuditCsv}
                disabled={exporting !== null}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportLabel('posting-audit')}
              </button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Missing posts</div>
                <div className={`mt-1 text-xl font-bold tabular-nums ${(postingAudit?.total_count ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {postingAudit?.total_count ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Affected amount</div>
                <div className={`mt-1 text-xl font-bold tabular-nums ${(postingAudit?.total_amount_cents ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {money(postingAudit?.total_amount_cents ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4">
          {postingAuditQ.isLoading ? (
            <div className="rounded-lg border border-slate-200 py-8 text-center text-sm text-slate-500">Checking posting status...</div>
          ) : postingAuditRows.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-8 text-center text-sm font-semibold text-emerald-800">
              No missing GL posts in this date range.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postingAuditRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.record_type}</td>
                      <td className="px-3 py-2 text-slate-700">{row.reference || row.source_id}</td>
                      <td className="px-3 py-2 text-slate-600">{row.record_date || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.status || '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{money(row.amount_cents)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {postingAudit?.truncated ? (
                <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Showing the first 200 missing posts. Narrow the date range to review the rest.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <StatementPanel
              title="Income statement"
              description="Revenue, discounts, expenses, and net income for the selected date range."
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadIncomeStatementPdf}
                    disabled={exporting !== null}
                    className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportLabel('income', 'PDF')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadIncomeStatementCsv}
                    disabled={exporting !== null}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportLabel('income')}
                  </button>
                </div>
              }
              loading={incomeStatementQ.isLoading}
              emptyLabel="No income statement activity in this range."
              sections={[
                { label: 'Revenue', rows: incomeStatement?.sections.revenue ?? [] },
                { label: 'Discounts / contra revenue', rows: incomeStatement?.sections.contra_revenue ?? [], invert: true },
                { label: 'Expenses', rows: incomeStatement?.sections.expenses ?? [], invert: true },
              ]}
              totals={[
                { label: 'Gross revenue', cents: incomeStatement?.totals.gross_revenue_cents ?? 0 },
                { label: 'Discounts', cents: incomeStatement?.totals.discounts_cents ?? 0, invert: true },
                { label: 'Net revenue', cents: incomeStatement?.totals.net_revenue_cents ?? 0 },
                { label: 'Expenses', cents: incomeStatement?.totals.expenses_cents ?? 0, invert: true },
                { label: 'Net income', cents: incomeStatement?.totals.net_income_cents ?? 0, emphasis: true },
              ]}
              onAccountSelect={drillIntoAccount}
            />

            <StatementPanel
              title="Balance sheet"
              description="Assets, liabilities, equity, and current earnings as of the trial-balance date."
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadBalanceSheetPdf}
                    disabled={exporting !== null}
                    className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportLabel('balance', 'PDF')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadBalanceSheetCsv}
                    disabled={exporting !== null}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportLabel('balance')}
                  </button>
                </div>
              }
              loading={balanceSheetQ.isLoading}
              emptyLabel="No balance sheet accounts found."
              sections={[
                { label: 'Assets', rows: balanceSheet?.sections.assets ?? [] },
                { label: 'Liabilities', rows: balanceSheet?.sections.liabilities ?? [] },
                { label: 'Equity', rows: balanceSheet?.sections.equity ?? [] },
              ]}
              totals={[
                { label: 'Assets', cents: balanceSheet?.totals.assets_cents ?? 0 },
                { label: 'Liabilities', cents: balanceSheet?.totals.liabilities_cents ?? 0 },
                { label: 'Equity', cents: balanceSheet?.totals.equity_cents ?? 0 },
                { label: 'Current earnings', cents: balanceSheet?.totals.current_earnings_cents ?? 0 },
                { label: 'Liabilities + equity', cents: balanceSheet?.totals.liabilities_and_equity_cents ?? 0, emphasis: true },
              ]}
              onAccountSelect={drillIntoAccount}
            />
          </section>

          <CashFlowPanel
            report={cashFlowStatement}
            loading={cashFlowStatementQ.isLoading}
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadCashFlowStatementPdf}
                  disabled={exporting !== null}
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('cash-flow', 'PDF')}
                </button>
                <button
                  type="button"
                  onClick={downloadCashFlowStatementCsv}
                  disabled={exporting !== null}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('cash-flow')}
                </button>
              </div>
            }
          />

          <Panel
            title="Trial balance"
            description="CPA hand-off view. Use the date filter for month end, quarter end, or year end."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadTrialBalancePdf}
                  disabled={exporting !== null}
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('trial', 'PDF')}
                </button>
                <button
                  type="button"
                  onClick={downloadTrialBalanceCsv}
                  disabled={exporting !== null}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('trial')}
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <Th>Account</Th>
                    <Th>Type</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                  </tr>
                </thead>
                <tbody>
                  {trialRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <Td>
                        <button
                          type="button"
                          onClick={() => drillIntoAccount(row.code)}
                          className="text-left font-semibold text-slate-800 hover:text-amber-800 hover:underline"
                          title="Show this account in GL detail"
                        >
                          <span className="font-mono text-amber-700">{row.code}</span> {row.name}
                        </button>
                      </Td>
                      <Td className="capitalize">{row.account_type.replace('_', ' ')}</Td>
                      <Td align="right">{row.balance_debit_cents ? money(row.balance_debit_cents) : '-'}</Td>
                      <Td align="right">{row.balance_credit_cents ? money(row.balance_credit_cents) : '-'}</Td>
                    </tr>
                  ))}
                  {trialBalanceQ.isLoading && <EmptyRow colSpan={4} label="Loading trial balance..." />}
                  {!trialBalanceQ.isLoading && trialRows.length === 0 && <EmptyRow colSpan={4} label="No accounts found." />}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="GL detail"
            description="Line-level ledger drilldown by account, source, status, and date range."
            action={
              <div className="flex flex-wrap gap-2">
                <select
                  value={detailAccountCode}
                  onChange={(event) => {
                    setDetailAccountCode(event.target.value)
                    setDetailPage(1)
                  }}
                  className="w-52 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">All accounts</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.code}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </select>
                <select
                  value={detailStatus}
                  onChange={(event) => {
                    setDetailStatus(event.target.value)
                    setDetailPage(1)
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="posted">Posted</option>
                  <option value="pending">Pending</option>
                  <option value="reversed">Reversed</option>
                  <option value="void">Void</option>
                  <option value="all">All statuses</option>
                </select>
                <select
                  value={detailPerPage}
                  onChange={(event) => {
                    setDetailPerPage(event.target.value)
                    setDetailPage(1)
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="25">25 rows</option>
                  <option value="50">50 rows</option>
                  <option value="100">100 rows</option>
                </select>
                <button
                  type="button"
                  onClick={downloadGlDetailPdf}
                  disabled={exporting !== null}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('gl', 'Download PDF')}
                </button>
                <button
                  type="button"
                  onClick={downloadGlDetailCsv}
                  disabled={exporting !== null}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('gl')}
                </button>
              </div>
            }
          >
            <div className="mb-3 flex flex-col gap-2 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {detailLines.length} of {detailTotal} line{detailTotal === 1 ? '' : 's'} for {from} to {to}.
              </span>
              <PaginationControls
                page={detailCurrentPage}
                lastPage={detailLastPage}
                disabled={glDetailQ.isLoading}
                onPrevious={() => setDetailPage((current) => Math.max(1, current - 1))}
                onNext={() => setDetailPage((current) => Math.min(detailLastPage, current + 1))}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <Th>Date</Th>
                    <Th>Entry</Th>
                    <Th>Account</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                    <Th>Source</Th>
                    <Th>Memo</Th>
                  </tr>
                </thead>
                <tbody>
                  {detailLines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-100 last:border-0">
                      <Td className="whitespace-nowrap">{line.entry_date ?? '-'}</Td>
                      <Td>
                        <div className="font-semibold text-slate-900">{line.entry_number ?? 'Journal'}</div>
                        <div className="text-xs capitalize text-slate-500">{line.entry_status ?? ''} · {line.basis ?? ''}</div>
                      </Td>
                      <Td>
                        <span className="font-mono text-amber-700">{line.account?.code ?? '-'}</span> {line.account?.name ?? 'Unknown account'}
                      </Td>
                      <Td align="right">{line.debit_cents ? money(line.debit_cents) : '-'}</Td>
                      <Td align="right">{line.credit_cents ? money(line.credit_cents) : '-'}</Td>
                      <Td>
                        <div className="font-semibold text-slate-700">{line.source_type ?? 'manual'}</div>
                        <div className="max-w-[180px] truncate text-xs text-slate-500">{line.source_id ?? ''}</div>
                      </Td>
                      <Td className="max-w-[280px] truncate text-slate-600">{line.memo ?? ''}</Td>
                    </tr>
                  ))}
                  {glDetailQ.isLoading && <EmptyRow colSpan={7} label="Loading GL detail..." />}
                  {!glDetailQ.isLoading && detailLines.length === 0 && <EmptyRow colSpan={7} label="No GL detail lines in this filter." />}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Journal entries"
            description="Posted GL entries by date range. Source type helps isolate invoice, payment, PO, expense, payroll, and tax postings."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadJournalPdf}
                  disabled={exporting !== null}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('journal', 'Download PDF')}
                </button>
                <button
                  type="button"
                  onClick={downloadJournalCsv}
                  disabled={exporting !== null}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportLabel('journal')}
                </button>
              </div>
            }
          >
            <div className="mb-3 flex flex-col gap-2 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {journalEntries.length} of {journalTotal} journal entr{journalTotal === 1 ? 'y' : 'ies'}.
              </span>
              <PaginationControls
                page={journalCurrentPage}
                lastPage={journalLastPage}
                disabled={journalsQ.isLoading}
                onPrevious={() => setJournalPage((current) => Math.max(1, current - 1))}
                onNext={() => setJournalPage((current) => Math.min(journalLastPage, current + 1))}
              />
            </div>
            <div className="space-y-3">
              {journalEntries.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {entry.entry_number ?? 'Journal'} · {entry.entry_date ?? '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {entry.status} · {entry.basis} · {entry.source_type ?? 'manual'}
                      </div>
                      {entry.memo ? <p className="mt-1 text-sm text-slate-600">{entry.memo}</p> : null}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Posted
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <tbody>
                        {entry.lines.map((line) => (
                          <tr key={line.id} className="border-t border-slate-200">
                            <td className="py-2 pr-3">
                              <span className="font-mono text-amber-700">{line.account?.code ?? '-'}</span> {line.account?.name ?? 'Unknown account'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{line.debit_cents ? money(line.debit_cents) : '-'}</td>
                            <td className="py-2 pl-3 text-right font-mono">{line.credit_cents ? money(line.credit_cents) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
              {journalsQ.isLoading && <div className="py-8 text-center text-sm text-slate-500">Loading journal entries...</div>}
              {!journalsQ.isLoading && journalEntries.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No journal entries in this filter.</div>}
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Manual journal entry" description="Use for opening balances, owner draw, corrections, and bookkeeper adjustments.">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Entry date</span>
                <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Memo</span>
                <input value={memo} onChange={(event) => setMemo(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="What is this entry for?" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Reason</span>
                <input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Audit reason" />
              </label>

              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 p-3">
                    <select value={line.account_code} onChange={(event) => updateLine(index, { account_code: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Select account</option>
                      {accountOptions.map((account) => (
                        <option key={account.id} value={account.code}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value, credit: event.target.value ? '' : line.credit })} placeholder="Debit" type="number" min="0" step="0.01" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      <input value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value, debit: event.target.value ? '' : line.debit })} placeholder="Credit" type="number" min="0" step="0.01" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <input value={line.memo} onChange={(event) => updateLine(index, { memo: event.target.value })} placeholder="Line memo" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setLines([...lines, blankLine()])} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Add line
              </button>

              <div className={`rounded-lg border p-3 text-sm ${formBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                Debits {money(formDebit)} · Credits {money(formCredit)}
              </div>

              {journalValidationError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {journalValidationError}
                </div>
              )}
              {journalMutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {(journalMutation.error as Error)?.message || 'Could not post journal entry.'}
                </div>
              )}
              {journalMutation.isSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  Journal entry posted.
                </div>
              )}

              <button
                type="button"
                disabled={!formBalanced || journalMutation.isPending}
                onClick={submitJournal}
                className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {journalMutation.isPending ? 'Posting...' : 'Post journal'}
              </button>
            </div>
          </Panel>

          <Panel title="Year-end close" description="Move annual revenue and expense balances into retained earnings.">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Accounting year</span>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={yearEndCloseYear}
                  onChange={(event) => setYearEndCloseYear(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Retained earnings account</span>
                <select
                  value={yearEndRetainedCode}
                  onChange={(event) => setYearEndRetainedCode(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="3020">3020 · Retained Earnings</option>
                  {accountOptions
                    .filter((account) => account.account_type === 'equity' && account.code !== '3020')
                    .map((account) => (
                      <option key={account.id} value={account.code}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This posts one balanced journal entry dated December 31. If that month is closed or locked, reopen it first.
              </div>
              {yearEndCloseError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {yearEndCloseError}
                </div>
              )}
              {yearEndCloseMutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {(yearEndCloseMutation.error as Error)?.message || 'Could not close year.'}
                </div>
              )}
              {yearEndCloseMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {yearEndCloseMessage}
                </div>
              )}
              <button
                type="button"
                onClick={postYearEndClose}
                disabled={yearEndCloseMutation.isPending}
                className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {yearEndCloseMutation.isPending ? 'Closing year...' : 'Post year-end close'}
              </button>
            </div>
          </Panel>

          <Panel title="Owner draw" description="Post money paid to an owner without hand-building a journal entry.">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Draw date</span>
                <input
                  type="date"
                  value={ownerDrawForm.draw_on}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, draw_on: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Owner</span>
                <input
                  value={ownerDrawForm.owner_name}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, owner_name: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Owner name"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ownerDrawForm.amount}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Paid from</span>
                <select
                  value={ownerDrawForm.cash_account_code}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, cash_account_code: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="1010">1010 · Operating Checking</option>
                  <option value="1020">1020 · Undeposited Funds / Cash on Hand</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Reference</span>
                <input
                  value={ownerDrawForm.reference_number}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, reference_number: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Check, transfer, or memo number"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Memo</span>
                <textarea
                  value={ownerDrawForm.memo}
                  onChange={(event) => setOwnerDrawForm((current) => ({ ...current, memo: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional note"
                />
              </label>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Posts debit 3030 Owner Draw and credit the selected cash account.
              </div>
              {ownerDrawError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {ownerDrawError}
                </div>
              )}
              {ownerDrawMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {ownerDrawMessage}
                </div>
              )}
              {ownerDrawMutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {(ownerDrawMutation.error as Error)?.message || 'Could not post owner draw.'}
                </div>
              )}
              <button
                type="button"
                onClick={submitOwnerDraw}
                disabled={ownerDrawMutation.isPending}
                className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {ownerDrawMutation.isPending ? 'Posting draw...' : 'Post owner draw'}
              </button>
            </div>
          </Panel>

          <Panel title="Sales tax payment" description="Post a tax remittance against sales tax payable.">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Paid on</span>
                <input
                  type="date"
                  value={salesTaxPaymentForm.paid_on}
                  onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, paid_on: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount paid</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salesTaxPaymentForm.amount}
                  onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Tax period from</span>
                  <input
                    type="date"
                    value={salesTaxPaymentForm.from}
                    onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, from: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Tax period to</span>
                  <input
                    type="date"
                    value={salesTaxPaymentForm.to}
                    onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, to: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Paid from</span>
                <select
                  value={salesTaxPaymentForm.cash_account_code}
                  onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, cash_account_code: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="1010">1010 · Operating Checking</option>
                  <option value="1020">1020 · Undeposited Funds / Cash on Hand</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Reference</span>
                <input
                  value={salesTaxPaymentForm.reference_number}
                  onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, reference_number: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Confirmation, check, or ACH trace"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Memo</span>
                <textarea
                  value={salesTaxPaymentForm.memo}
                  onChange={(event) => setSalesTaxPaymentForm((current) => ({ ...current, memo: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional note"
                />
              </label>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Posts debit 2020 Sales Tax Payable and credit the selected cash account.
              </div>
              {salesTaxPaymentError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {salesTaxPaymentError}
                </div>
              )}
              {salesTaxPaymentMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {salesTaxPaymentMessage}
                </div>
              )}
              {salesTaxPaymentMutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {(salesTaxPaymentMutation.error as Error)?.message || 'Could not post sales tax payment.'}
                </div>
              )}
              <button
                type="button"
                onClick={submitSalesTaxPayment}
                disabled={salesTaxPaymentMutation.isPending}
                className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {salesTaxPaymentMutation.isPending ? 'Posting payment...' : 'Post sales tax payment'}
              </button>
            </div>
          </Panel>

          <Panel title="Chart of accounts" description="Active accounts used by the posting engine.">
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {accountOptions.map((account) => (
                <div key={account.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-900">
                    <span className="font-mono text-amber-700">{account.code}</span> {account.name}
                  </div>
                  <div className="mt-1 text-xs capitalize text-slate-500">
                    {account.account_type.replace('_', ' ')} · {account.normal_balance} normal
                  </div>
                </div>
              ))}
              {accountsQ.isLoading && <div className="py-8 text-center text-sm text-slate-500">Loading accounts...</div>}
            </div>
          </Panel>

          <Panel title="Accounting periods" description="Close or lock reviewed months so new postings cannot change finished books.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">From</span>
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(event) => setPeriodFrom(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">To</span>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(event) => setPeriodTo(event.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Close / reopen notes</span>
                <textarea
                  value={periodNotes}
                  onChange={(event) => setPeriodNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional audit note"
                />
              </label>

              {(closePeriodMutation.isError || reopenPeriodMutation.isError) && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {((closePeriodMutation.error || reopenPeriodMutation.error) as Error)?.message || 'Could not update period.'}
                </div>
              )}

              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {periods.map((period) => {
                  const pending = periodActionId === period.id && (closePeriodMutation.isPending || reopenPeriodMutation.isPending)
                  const isOpen = period.status === 'open'
                  const isLocked = period.status === 'locked'

                  return (
                    <div key={period.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{period.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {period.starts_on ?? '-'} to {period.ends_on ?? '-'} · {period.journal_entries_count} entries
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ${
                            isLocked
                              ? 'bg-red-50 text-red-700 ring-red-200'
                              : isOpen
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-amber-50 text-amber-700 ring-amber-200'
                          }`}
                        >
                          {period.status}
                        </span>
                      </div>
                      {period.closed_at ? (
                        <div className="mt-2 text-xs text-slate-500">
                          Closed {new Date(period.closed_at).toLocaleString()} by {period.closed_by?.name ?? 'Unknown'}
                        </div>
                      ) : null}
                      {period.close_notes ? <p className="mt-2 text-xs text-slate-600">{period.close_notes}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isOpen ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => closePeriod(period.id, false)}
                              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pending ? 'Working...' : 'Close'}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => closePeriod(period.id, true)}
                              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pending ? 'Working...' : 'Lock'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => reopenPeriod(period.id)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pending ? 'Working...' : 'Reopen'}
                          </button>
                        )}
                        {!isOpen && !isLocked ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => closePeriod(period.id, true)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pending ? 'Working...' : 'Lock'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                {periodsQ.isLoading && <div className="py-8 text-center text-sm text-slate-500">Loading periods...</div>}
                {!periodsQ.isLoading && periods.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No accounting periods in this range.</div>}
              </div>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  )
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function StatementPanel({
  title,
  description,
  action,
  sections,
  totals,
  loading,
  emptyLabel,
  onAccountSelect,
}: {
  title: string
  description: string
  action?: ReactNode
  sections: Array<{ label: string; rows: StatementRow[]; invert?: boolean }>
  totals: Array<{ label: string; cents: number; invert?: boolean; emphasis?: boolean }>
  loading: boolean
  emptyLabel: string
  onAccountSelect?: (accountCode: string) => void
}) {
  const hasRows = sections.some((section) => section.rows.length > 0)

  return (
    <Panel title={title} description={description} action={action}>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {section.rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onAccountSelect?.(row.code)}
                      className="max-w-full truncate text-left font-semibold text-slate-800 hover:text-amber-800 hover:underline disabled:cursor-default disabled:text-slate-800 disabled:no-underline"
                      disabled={!onAccountSelect}
                      title="Show this account in GL detail"
                    >
                      <span className="font-mono text-amber-700">{row.code}</span> {row.name}
                    </button>
                  </div>
                  <div className="font-mono font-semibold tabular-nums text-slate-900">
                    {section.invert && row.balance_cents > 0 ? '-' : ''}{money(row.balance_cents)}
                  </div>
                </div>
              ))}
              {section.rows.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-400">No rows.</div>
              )}
            </div>
          </div>
        ))}

        {loading && <div className="py-6 text-center text-sm text-slate-500">Loading statement...</div>}
        {!loading && !hasRows && <div className="py-6 text-center text-sm text-slate-500">{emptyLabel}</div>}

        <div className="divide-y divide-slate-100 rounded-lg bg-slate-50 p-3">
          {totals.map((total) => (
            <div
              key={total.label}
              className={`flex items-center justify-between gap-3 py-2 text-sm ${
                total.emphasis ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'
              }`}
            >
              <span>{total.label}</span>
              <span className="font-mono tabular-nums">
                {total.invert && total.cents > 0 ? '-' : ''}{money(total.cents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function CashFlowPanel({
  report,
  loading,
  action,
}: {
  report?: CashFlowStatementReport
  loading: boolean
  action?: ReactNode
}) {
  const sections = [
    { key: 'operating', label: 'Operating activities', rows: report?.sections.operating ?? [] },
    { key: 'investing', label: 'Investing activities', rows: report?.sections.investing ?? [] },
    { key: 'financing', label: 'Financing activities', rows: report?.sections.financing ?? [] },
  ]
  const hasRows = sections.some((section) => section.rows.length > 0)

  return (
    <Panel
      title="Statement of cash flows"
      description="Beginning cash, operating changes, investing activity, financing activity, and ending cash for the selected date range."
      action={action}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {section.rows.map((row) => (
                  <div key={`${section.key}-${row.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 truncate font-semibold text-slate-800">{row.label}</div>
                    <div className={`font-mono font-semibold tabular-nums ${row.amount_cents < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                      {money(row.amount_cents)}
                    </div>
                  </div>
                ))}
                {section.rows.length === 0 && (
                  <div className="px-3 py-3 text-sm text-slate-400">No activity.</div>
                )}
              </div>
            </div>
          ))}

          {loading && <div className="py-6 text-center text-sm text-slate-500">Loading cash flow...</div>}
          {!loading && !hasRows && <div className="py-6 text-center text-sm text-slate-500">No cash-flow activity in this range.</div>}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="space-y-2 text-sm">
            <CashFlowTotal label="Beginning cash" cents={report?.totals.beginning_cash_cents ?? 0} />
            <CashFlowTotal label="Operating cash" cents={report?.totals.operating_cash_cents ?? 0} />
            <CashFlowTotal label="Investing cash" cents={report?.totals.investing_cash_cents ?? 0} />
            <CashFlowTotal label="Financing cash" cents={report?.totals.financing_cash_cents ?? 0} />
            <CashFlowTotal label="Net cash change" cents={report?.totals.net_cash_change_cents ?? 0} emphasis />
            <CashFlowTotal label="Ending cash" cents={report?.totals.ending_cash_cents ?? 0} emphasis />
          </div>
          <div className={`mt-4 rounded-md px-3 py-2 text-xs font-semibold ${
            report?.totals.is_reconciled === false ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          }`}>
            {report?.totals.is_reconciled === false ? 'Needs review: calculated change differs from cash accounts.' : 'Reconciled to cash accounts.'}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function CashFlowTotal({ label, cents, emphasis = false }: { label: string; cents: number; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-0 ${emphasis ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'}`}>
      <span>{label}</span>
      <span className={`font-mono tabular-nums ${cents < 0 ? 'text-red-700' : ''}`}>{money(cents)}</span>
    </div>
  )
}

function PaginationControls({
  page,
  lastPage,
  disabled,
  onPrevious,
  onNext,
}: {
  page: number
  lastPage: number
  disabled?: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={onPrevious}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-slate-500">
        Page {page} of {Math.max(1, lastPage)}
      </span>
      <button
        type="button"
        disabled={disabled || page >= lastPage}
        onClick={onNext}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return <td className={`px-3 py-3 ${align === 'right' ? 'text-right font-mono' : 'text-left'} ${className}`}>{children}</td>
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="py-10 text-center text-sm text-slate-500" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  )
}
