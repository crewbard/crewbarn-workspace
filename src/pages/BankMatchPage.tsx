import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import type { PaginatedResponse } from '@/types/api'

type BankSuggestion = {
  matched_type: 'payment' | 'expense' | 'purchase_order' | 'vendor_bill' | 'other' | 'invoice'
  matched_id: string
  label: string
  detail: string
  date?: string | null
  amount_cents: number
  confidence: number
}

type BankTransaction = {
  id: string
  transaction_date: string
  description: string
  memo?: string | null
  amount_cents: number
  transaction_type: string
  source: string
  bank_account_name?: string | null
  bank_account_last4?: string | null
  external_id?: string | null
  match_status: string
  matched_type?: string | null
  matched_id?: string | null
  notes?: string | null
  splits?: BankTransactionSplit[]
  suggestions: BankSuggestion[]
}

type BankTransactionSplit = {
  id: string
  line_type: 'expense' | 'other'
  amount_cents: number
  tax_cents: number
  category?: string | null
  description: string
  matched_type?: string | null
  matched_id?: string | null
}

type UnmatchedPayment = {
  id: string
  received_at?: string | null
  amount_cents: number
  tip_cents: number
  payment_method: string
  payment_reference?: string | null
  customer?: {
    id: string
    name?: string | null
  } | null
  work_order?: {
    id: string
    job_number?: string | null
    title?: string | null
  } | null
}

type ReconciliationRun = {
  id: string
  bank_account_name?: string | null
  bank_account_last4?: string | null
  statement_start_date?: string | null
  statement_end_date?: string | null
  statement_ending_balance_cents: number
  cleared_deposit_cents: number
  cleared_withdrawal_cents: number
  book_ending_balance_cents: number
  difference_cents: number
  status: 'draft' | 'reviewed' | 'closed' | 'void'
  notes?: string | null
  closed_at?: string | null
  updated_at?: string | null
}

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100)
}

function signedDollars(cents: number) {
  const formatted = dollars(Math.abs(cents))
  return cents < 0 ? `-${formatted}` : formatted
}

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  if (rows.length === 0) {
    return
  }

  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function BankMatchPage() {
  const queryClient = useQueryClient()
  const tenantTimezone = useTenantTimezone()
  const today = tenantDate(tenantTimezone)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<'10' | '50' | '100'>('50')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [splitMessage, setSplitMessage] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    q: '',
    match_status: 'unmatched',
    transaction_type: '',
    date_from: today.slice(0, 8) + '01',
    date_to: today,
  })
  const [form, setForm] = useState({
    transaction_date: today,
    description: '',
    amount: '',
    transaction_type: '',
    bank_account_name: '',
    bank_account_last4: '',
    memo: '',
  })
  useEffect(() => {
    setFilters((current) => ({ ...current, date_from: today.slice(0, 8) + '01', date_to: today }))
    setForm((current) => ({ ...current, transaction_date: today }))
  }, [today])

  const [csvForm, setCsvForm] = useState({
    csv_text: '',
    bank_account_name: '',
    bank_account_last4: '',
  })
  const [reconForm, setReconForm] = useState({
    bank_account_name: '',
    bank_account_last4: '',
    statement_ending_balance: '',
    notes: '',
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ per_page: perPage, page: String(page), with_suggestions: '1' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params.toString()
  }, [filters, page, perPage])

  const transactionsQ = useQuery({
    queryKey: ['bank-transactions', queryString],
    queryFn: () => apiRequest<PaginatedResponse<BankTransaction>>(`/v1/bank-transactions?${queryString}`),
  })

  const unmatchedPaymentsQueryString = useMemo(() => {
    const params = new URLSearchParams({ per_page: perPage })
    if (filters.q) params.set('q', filters.q)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    return params.toString()
  }, [filters.date_from, filters.date_to, filters.q, perPage])

  const unmatchedPaymentsQ = useQuery({
    queryKey: ['bank-transactions', 'unmatched-payments', unmatchedPaymentsQueryString],
    queryFn: () =>
      apiRequest<PaginatedResponse<UnmatchedPayment>>(
        `/v1/bank-transactions/unmatched-payments?${unmatchedPaymentsQueryString}`,
      ),
  })

  const reconciliationRunsQ = useQuery({
    queryKey: ['accounting', 'reconciliation-runs', filters.date_from, filters.date_to, reconForm.bank_account_last4],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: '5' })
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      if (reconForm.bank_account_last4) params.set('bank_account_last4', reconForm.bank_account_last4)
      return apiRequest<PaginatedResponse<ReconciliationRun>>(`/v1/accounting/reconciliation-runs?${params.toString()}`)
    },
  })

  const createTransaction = useMutation({
    mutationFn: (payload: typeof form) =>
      apiRequest<{ data: BankTransaction }>('/v1/bank-transactions', {
        method: 'POST',
        body: {
          ...payload,
          amount: Number(payload.amount || 0),
          transaction_type: payload.transaction_type || null,
          bank_account_name: payload.bank_account_name || null,
          bank_account_last4: payload.bank_account_last4 || null,
          memo: payload.memo || null,
        },
      }),
    onSuccess: () => {
      setForm({
        transaction_date: today,
        description: '',
        amount: '',
        transaction_type: '',
        bank_account_name: '',
        bank_account_last4: '',
        memo: '',
      })
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
  })

  const importCsv = useMutation({
    mutationFn: (payload: typeof csvForm) =>
      apiRequest<{ data: { import_batch_id: string; created_count: number; skipped_count: number } }>('/v1/bank-transactions/import-csv', {
        method: 'POST',
        body: {
          ...payload,
          bank_account_name: payload.bank_account_name || null,
          bank_account_last4: payload.bank_account_last4 || null,
        },
      }),
    onSuccess: () => {
      setCsvForm({ csv_text: '', bank_account_name: '', bank_account_last4: '' })
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
  })

  const createReconciliationRun = useMutation({
    mutationFn: (payload: typeof reconForm) =>
      apiRequest<{ data: ReconciliationRun }>('/v1/accounting/reconciliation-runs', {
        method: 'POST',
        body: {
          bank_account_name: payload.bank_account_name || null,
          bank_account_last4: payload.bank_account_last4 || null,
          statement_start_date: filters.date_from || null,
          statement_end_date: filters.date_to || today,
          statement_ending_balance: Number(payload.statement_ending_balance || 0),
          notes: payload.notes || null,
        },
      }),
    onSuccess: () => {
      setReconForm((old) => ({ ...old, statement_ending_balance: '', notes: '' }))
      queryClient.invalidateQueries({ queryKey: ['accounting', 'reconciliation-runs'] })
    },
  })

  const closeReconciliationRun = useMutation({
    mutationFn: (run: ReconciliationRun) =>
      apiRequest<{ data: ReconciliationRun }>(`/v1/accounting/reconciliation-runs/${run.id}/close`, {
        method: 'POST',
        body: { notes: run.notes ?? null },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounting', 'reconciliation-runs'] }),
  })

  const matchTransaction = useMutation({
    mutationFn: ({ transaction, suggestion }: { transaction: BankTransaction; suggestion: BankSuggestion }) =>
      // An "invoice" suggestion is a deposit with no payment recorded yet
      // (a customer's bank transfer): this records the ACH payment on the
      // invoice and matches the row in one step.
      suggestion.matched_type === 'invoice'
        ? apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/record-invoice-payment`, {
            method: 'POST',
            body: { invoice_id: suggestion.matched_id },
          })
        : apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/match`, {
            method: 'POST',
            body: {
              matched_type: suggestion.matched_type,
              matched_id: suggestion.matched_id,
              notes: `Matched from suggested ${suggestion.matched_type}.`,
            },
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['bank-transfer-expected'] })
    },
  })

  const markOtherTransaction = useMutation({
    mutationFn: ({ transaction, note }: { transaction: BankTransaction; note: string }) =>
      apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/match`, {
        method: 'POST',
        body: {
          matched_type: 'other',
          matched_id: transaction.id,
          notes: note,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-transactions'] }),
  })

  const ignoreTransaction = useMutation({
    mutationFn: (transaction: BankTransaction) =>
      apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/ignore`, {
        method: 'POST',
        body: { notes: 'Ignored during bank match review.' },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-transactions'] }),
  })

  const resetTransaction = useMutation({
    mutationFn: (transaction: BankTransaction) =>
      apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/reset`, {
        method: 'POST',
        body: {
          notes: 'Reset to unmatched during bank match review.',
          reverse_vendor_bill_payment: transaction.matched_type === 'vendor_bill',
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-transactions'] }),
  })

  const createExpenseFromBankRow = useMutation({
    mutationFn: ({ transaction, description }: { transaction: BankTransaction; description: string }) =>
      apiRequest<{ data: BankTransaction; expense: { id: string; description: string; total_cents: number } }>(
        `/v1/bank-transactions/${transaction.id}/create-expense`,
        {
          method: 'POST',
          body: {
            description,
            category: 'other',
          },
        },
      ),
    onSuccess: () => {
      setSplitMessage(null)
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const splitBankTransaction = useMutation({
    mutationFn: ({ transaction, lines }: { transaction: BankTransaction; lines: Array<{ line_type: 'expense'; amount: number; description: string; category: string }> }) =>
      apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/split`, {
        method: 'POST',
        body: { lines },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const reverseSplitTransaction = useMutation({
    mutationFn: ({ transaction, reason }: { transaction: BankTransaction; reason: string }) =>
      apiRequest<{ data: BankTransaction }>(`/v1/bank-transactions/${transaction.id}/reverse-split`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  function resetBankRow(transaction: BankTransaction) {
    if (transaction.matched_type === 'vendor_bill') {
      const confirmed = window.confirm(
        'This bank row posted a vendor bill payment. Resetting it will reverse that bill payment and reopen the bill balance. Continue?',
      )
      if (!confirmed) return
    }

    resetTransaction.mutate(transaction)
  }

  function markBankRowOther(transaction: BankTransaction) {
    const note = window.prompt(
      'What is this bank row? Example: bank fee, transfer, interest, owner draw, correction.',
      transaction.transaction_type === 'fee' ? 'Bank fee' : 'Other reconciled bank row',
    )
    if (note === null) return
    const trimmed = note.trim()
    markOtherTransaction.mutate({
      transaction,
      note: trimmed || 'Other reconciled bank row',
    })
  }

  function createExpenseForBankRow(transaction: BankTransaction) {
    const defaultDescription = transaction.description || 'Bank expense'
    const description = window.prompt('Expense description', defaultDescription)
    if (description === null) return

    const trimmed = description.trim() || defaultDescription
    createExpenseFromBankRow.mutate({ transaction, description: trimmed })
  }

  function splitBankRow(transaction: BankTransaction) {
    setSplitMessage(null)
    const total = dollars(Math.abs(transaction.amount_cents))
    const raw = window.prompt(
      `Split ${total}. Use: amount|description|category; amount|description|category\nExample: 84.31|Fuel station|fuel; 12.00|Bank fee|bank_fee`,
      '',
    )
    if (raw === null) return

    const lines = raw
      .split(/[;\n]+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [amountRaw, descriptionRaw, categoryRaw] = chunk.split('|').map((part) => part?.trim() ?? '')
        return {
          line_type: 'expense' as const,
          amount: Number(amountRaw || 0),
          description: descriptionRaw || 'Bank split expense',
          category: categoryRaw || 'other',
        }
      })
      .filter((line) => Number.isFinite(line.amount) && line.amount > 0)

    if (lines.length < 2) {
      setSplitMessage('Add at least two split lines before saving a bank split.')
      return
    }

    const totalCents = lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0)
    if (totalCents !== Math.abs(transaction.amount_cents)) {
      setSplitMessage(`Split total must equal ${total}. Current total is ${dollars(totalCents)}.`)
      return
    }

    splitBankTransaction.mutate({ transaction, lines })
  }

  function reverseSplitBankRow(transaction: BankTransaction) {
    const reason = window.prompt('Reason for reversing this split', 'Split entered incorrectly')
    if (reason === null) return

    reverseSplitTransaction.mutate({
      transaction,
      reason: reason.trim() || 'Split entered incorrectly',
    })
  }

  const transactions = transactionsQ.data?.data ?? []
  const unmatchedPayments = unmatchedPaymentsQ.data?.data ?? []
  const unmatchedPaymentsMeta = unmatchedPaymentsQ.data?.meta
  const reconciliationRuns = reconciliationRunsQ.data?.data ?? []
  const meta = transactionsQ.data?.meta
  const unmatchedCount = transactions.filter((transaction) => transaction.match_status === 'unmatched').length
  const suggestedCount = transactions.filter((transaction) => transaction.suggestions?.length > 0).length
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount_cents, 0)
  const downloadVisibleTransactions = () => {
    setExportMessage(null)
    if (transactions.length === 0) {
      setExportMessage('No bank rows match the current filter.')
      return
    }

    downloadCsv(
      `bank-match-${filters.date_from || 'all'}-${filters.date_to || today}.csv`,
      ['Date', 'Description', 'Memo', 'Amount', 'Type', 'Status', 'Source', 'Account', 'Last 4', 'Matched type', 'Matched ID', 'External ID', 'Notes', 'Suggestion count'],
      transactions.map((transaction) => [
        transaction.transaction_date,
        transaction.description,
        transaction.memo ?? '',
        signedDollars(transaction.amount_cents),
        transaction.transaction_type,
        transaction.match_status,
        transaction.source,
        transaction.bank_account_name ?? '',
        transaction.bank_account_last4 ?? '',
        transaction.matched_type ?? '',
        transaction.matched_id ?? '',
        transaction.external_id ?? '',
        transaction.notes ?? '',
        transaction.suggestions?.length ?? 0,
      ]),
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    createTransaction.mutate(form)
  }

  function submitCsv(event: FormEvent) {
    event.preventDefault()
    importCsv.mutate(csvForm)
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Accounting</p>
            <h1 className="mt-1 text-3xl font-black">Bank Match</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Import or enter bank statement rows, then match deposits and withdrawals to CrewBarn payments, vendor bills, expenses, and purchase orders.
            </p>
          </div>
          <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" to="/accounting/bank-match">
            Back to workspace
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryTile label="Rows in filter" value={String(transactions.length)} />
          <SummaryTile label="Suggested matches" value={String(suggestedCount)} />
          <SummaryTile label="Net filter total" value={signedDollars(total)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Statement reconciliation</h2>
              <p className="text-sm text-slate-500">
                Save a reconciliation run for this statement period after matching deposits and withdrawals. Close it when the bank statement and CrewBarn match.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
              {filters.date_from || 'Start'} to {filters.date_to || today}
            </span>
          </div>
          <form
            className="mt-4 grid gap-3 lg:grid-cols-12"
            onSubmit={(event) => {
              event.preventDefault()
              createReconciliationRun.mutate(reconForm)
            }}
          >
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              Account
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={reconForm.bank_account_name}
                onChange={(e) => setReconForm((old) => ({ ...old, bank_account_name: e.target.value }))}
                placeholder="Operating checking"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Last 4
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={reconForm.bank_account_last4}
                onChange={(e) => setReconForm((old) => ({ ...old, bank_account_last4: e.target.value }))}
                placeholder="1234"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Statement ending
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                inputMode="decimal"
                value={reconForm.statement_ending_balance}
                onChange={(e) => setReconForm((old) => ({ ...old, statement_ending_balance: e.target.value }))}
                placeholder="1520.00"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              Review note
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={reconForm.notes}
                onChange={(e) => setReconForm((old) => ({ ...old, notes: e.target.value }))}
                placeholder="Statement reviewed by..."
              />
            </label>
            <div className="flex items-end lg:col-span-2">
              <button className="w-full rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={createReconciliationRun.isPending}>
                {createReconciliationRun.isPending ? 'Saving...' : 'Save reconciliation'}
              </button>
            </div>
          </form>
          {createReconciliationRun.error ? <p className="mt-3 text-sm font-semibold text-red-700">Could not save reconciliation run.</p> : null}
          {closeReconciliationRun.error ? (
            <p className="mt-3 text-sm font-semibold text-red-700">
              {closeReconciliationRun.error instanceof Error
                ? closeReconciliationRun.error.message
                : 'Could not close reconciliation run.'}
            </p>
          ) : null}
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-6 gap-3 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <span>Period</span>
              <span>Account</span>
              <span>Status</span>
              <span className="text-right">Cleared</span>
              <span className="text-right">Difference</span>
              <span className="text-right">Action</span>
            </div>
            {reconciliationRunsQ.isLoading ? (
              <div className="px-3 py-4 text-sm text-slate-500">Loading reconciliation runs...</div>
            ) : reconciliationRuns.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">No saved reconciliation runs for this filter yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reconciliationRuns.map((run) => {
                  const canClose = run.difference_cents === 0

                  return (
                    <div key={run.id} className="grid grid-cols-6 gap-3 px-3 py-3 text-sm">
                      <div className="font-semibold text-slate-900">
                        {run.statement_start_date ?? 'Start'} to {run.statement_end_date ?? 'End'}
                      </div>
                      <div className="text-slate-600">
                        {run.bank_account_name || 'Bank account'}{run.bank_account_last4 ? ` • ${run.bank_account_last4}` : ''}
                      </div>
                      <div>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${run.status === 'closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="text-right font-mono font-semibold">
                        {dollars(run.cleared_deposit_cents - run.cleared_withdrawal_cents)}
                      </div>
                      <div className={`text-right font-mono font-bold ${canClose ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {signedDollars(run.difference_cents)}
                      </div>
                      <div className="text-right">
                        {run.status !== 'closed' ? (
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={closeReconciliationRun.isPending || !canClose}
                            onClick={() => closeReconciliationRun.mutate(run)}
                            title={canClose ? 'Close reconciliation run' : 'Difference must be $0.00 before closing.'}
                            type="button"
                          >
                            {canClose ? 'Close' : 'Balance first'}
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">{run.closed_at ? run.closed_at.slice(0, 10) : 'Closed'}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-amber-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-amber-100 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">CrewBarn payments not found in bank</h2>
              <p className="text-sm text-slate-500">
                Received payments in this date range that have not been matched to a bank deposit row yet.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
              {unmatchedPaymentsMeta?.total ?? unmatchedPayments.length} unmatched
            </span>
          </div>
          {unmatchedPaymentsQ.isLoading ? (
            <div className="p-6 text-center text-slate-500">Checking CrewBarn payments...</div>
          ) : unmatchedPayments.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No unmatched CrewBarn payments in this filter.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {unmatchedPayments.map((payment) => (
                <div key={payment.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">
                        {payment.received_at ? payment.received_at.slice(0, 10) : 'No received date'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-600">
                        {payment.payment_method.replace(/_/g, ' ')}
                      </span>
                      {payment.payment_reference ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          Ref {payment.payment_reference}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-black text-slate-950">
                      {payment.customer?.name ?? 'Customer payment'}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {payment.work_order?.job_number ? `Job ${payment.work_order.job_number}` : payment.work_order?.title ?? payment.id}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="font-mono text-lg font-black text-slate-950">{dollars(payment.amount_cents)}</div>
                    <div className="text-xs font-semibold text-slate-500">
                      Import the bank deposit, then match it to this payment.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Add statement row</h2>
              <p className="text-sm text-slate-500">Positive amount for deposits, negative amount for withdrawals. CSV import can build on this same table.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">{unmatchedCount} unmatched</span>
          </div>
          <form className="mt-4 grid gap-3 lg:grid-cols-12" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Date
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.transaction_date} onChange={(e) => setForm((old) => ({ ...old, transaction_date: e.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Amount
              <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={form.amount} onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))} placeholder="-125.49 or 1520.00" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Type
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.transaction_type} onChange={(e) => setForm((old) => ({ ...old, transaction_type: e.target.value }))}>
                <option value="">Auto</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="fee">Fee</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              Description
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} placeholder="Bank row description" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Account
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.bank_account_name} onChange={(e) => setForm((old) => ({ ...old, bank_account_name: e.target.value }))} placeholder="Operating checking" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-1">
              Last 4
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.bank_account_last4} onChange={(e) => setForm((old) => ({ ...old, bank_account_last4: e.target.value }))} placeholder="1234" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-10">
              Memo
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.memo} onChange={(e) => setForm((old) => ({ ...old, memo: e.target.value }))} placeholder="Optional note from statement" />
            </label>
            <div className="flex items-end lg:col-span-2">
              <button className="w-full rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? 'Saving...' : 'Save row'}
              </button>
            </div>
          </form>
          {createTransaction.error ? <p className="mt-3 text-sm font-semibold text-red-700">Could not save bank row.</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-bold">Paste CSV statement</h2>
            <p className="text-sm text-slate-500">
              Supports headers like Date, Description, Amount, Debit, Credit, Memo, and Reference. Keep imports under 1,000 rows.
            </p>
          </div>
          <form className="mt-4 grid gap-3 lg:grid-cols-12" onSubmit={submitCsv}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-4">
              Account
              <input className="rounded-md border border-slate-300 px-3 py-2" value={csvForm.bank_account_name} onChange={(e) => setCsvForm((old) => ({ ...old, bank_account_name: e.target.value }))} placeholder="Operating checking" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Last 4
              <input className="rounded-md border border-slate-300 px-3 py-2" value={csvForm.bank_account_last4} onChange={(e) => setCsvForm((old) => ({ ...old, bank_account_last4: e.target.value }))} placeholder="1234" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-12">
              CSV rows
              <textarea
                className="min-h-32 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                value={csvForm.csv_text}
                onChange={(e) => setCsvForm((old) => ({ ...old, csv_text: e.target.value }))}
                placeholder={'Date,Description,Amount\n2026-06-12,Stripe deposit,1520.00\n2026-06-13,Fuel station,-84.31'}
                required
              />
            </label>
            <div className="flex items-end gap-3 lg:col-span-12">
              <button className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={importCsv.isPending}>
                {importCsv.isPending ? 'Importing...' : 'Import CSV'}
              </button>
              {importCsv.data ? (
                <p className="text-sm font-semibold text-emerald-700">
                  Imported {importCsv.data.data.created_count} rows, skipped {importCsv.data.data.skipped_count}.
                </p>
              ) : null}
              {importCsv.error ? <p className="text-sm font-semibold text-red-700">Could not import CSV.</p> : null}
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-12">
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-3" placeholder="Search bank rows..." value={filters.q} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, q: e.target.value })) }} />
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_from} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, date_from: e.target.value })) }} />
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_to} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, date_to: e.target.value })) }} />
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.match_status} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, match_status: e.target.value })) }}>
              <option value="">All statuses</option>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="ignored">Ignored</option>
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-1" value={filters.transaction_type} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, transaction_type: e.target.value })) }}>
              <option value="">All types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="fee">Fee</option>
              <option value="transfer">Transfer</option>
              <option value="unknown">Unknown</option>
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-1"
              value={perPage}
              onChange={(e) => {
                setPage(1)
                setPerPage(e.target.value as typeof perPage)
              }}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold lg:col-span-1" onClick={() => { setPage(1); setFilters({ q: '', match_status: 'unmatched', transaction_type: '', date_from: '', date_to: today }) }}>
              Clear
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2"
              disabled={transactions.length === 0}
              onClick={downloadVisibleTransactions}
              type="button"
            >
              Export visible
            </button>
          </div>
          {exportMessage || splitMessage ? (
            <div className="mx-4 mt-3 space-y-2">
              {exportMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {exportMessage}
                </div>
              ) : null}
              {splitMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {splitMessage}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="divide-y divide-slate-100">
            {transactionsQ.isLoading ? (
              <div className="p-8 text-center text-slate-500">Loading bank rows...</div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No bank rows in this filter.</div>
            ) : transactions.map((transaction) => (
              <article className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]" key={transaction.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-500">{transaction.transaction_date}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${transaction.amount_cents >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {signedDollars(transaction.amount_cents)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{transaction.match_status}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{transaction.transaction_type}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-black text-slate-950">{transaction.description}</h3>
                  <p className="mt-1 text-sm text-slate-500">{transaction.memo || transaction.bank_account_name || 'No memo'}</p>
                  {transaction.matched_type && transaction.matched_id ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      Matched to {transaction.matched_type.replace('_', ' ')} {transaction.matched_id}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-700">Suggestions</h4>
                    <div className="flex items-center gap-3">
                      {transaction.match_status === 'unmatched' || transaction.match_status === 'suggested' ? (
                        <button className="text-xs font-bold text-slate-500 hover:text-slate-900" disabled={ignoreTransaction.isPending} onClick={() => ignoreTransaction.mutate(transaction)}>
                          Ignore
                        </button>
                      ) : null}
                      {transaction.match_status === 'unmatched' || transaction.match_status === 'suggested' ? (
                        <button
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                          disabled={markOtherTransaction.isPending}
                          onClick={() => markBankRowOther(transaction)}
                        >
                          Mark other
                        </button>
                      ) : null}
                      {(transaction.match_status === 'unmatched' || transaction.match_status === 'suggested') && transaction.amount_cents < 0 ? (
                        <button
                          className="text-xs font-bold text-amber-700 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={createExpenseFromBankRow.isPending}
                          onClick={() => createExpenseForBankRow(transaction)}
                          type="button"
                        >
                          Create expense
                        </button>
                      ) : null}
                      {(transaction.match_status === 'unmatched' || transaction.match_status === 'suggested') && transaction.amount_cents < 0 ? (
                        <button
                          className="text-xs font-bold text-slate-700 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={splitBankTransaction.isPending}
                          onClick={() => splitBankRow(transaction)}
                          type="button"
                        >
                          Split
                        </button>
                      ) : null}
                      {transaction.match_status === 'ignored' || transaction.match_status === 'matched' ? (
                        transaction.matched_type === 'split' ? (
                          <button
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={reverseSplitTransaction.isPending}
                            onClick={() => reverseSplitBankRow(transaction)}
                            type="button"
                          >
                            Reverse split
                          </button>
                        ) : (
                          <button className="text-xs font-bold text-amber-700 hover:text-amber-900" disabled={resetTransaction.isPending} onClick={() => resetBankRow(transaction)}>
                            {transaction.matched_type === 'vendor_bill' ? 'Reverse + reset' : 'Reset'}
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {transaction.suggestions?.length ? transaction.suggestions.map((suggestion) => (
                      <button
                        className="w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-amber-300 disabled:opacity-60"
                        disabled={matchTransaction.isPending || transaction.match_status === 'matched'}
                        key={`${suggestion.matched_type}-${suggestion.matched_id}`}
                        onClick={() => matchTransaction.mutate({ transaction, suggestion })}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{suggestion.label}</div>
                            <div className="text-xs text-slate-500">{suggestion.detail}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black">{dollars(suggestion.amount_cents)}</div>
                            <div className="text-xs font-bold text-emerald-700">{suggestion.confidence}%</div>
                          </div>
                        </div>
                      </button>
                    )) : (
                      <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                        No amount/date match yet. Use Create expense for unmatched withdrawals that are real business spend.
                      </p>
                    )}
                    {transaction.splits?.length ? (
                      <div className="rounded-md border border-amber-200 bg-white p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Split lines</div>
                        <div className="mt-2 space-y-1">
                          {transaction.splits.map((split) => (
                            <div key={split.id} className="flex items-start justify-between gap-3 text-sm">
                              <div>
                                <div className="font-semibold text-slate-900">{split.description}</div>
                                <div className="text-xs text-slate-500">{split.category ?? split.line_type}</div>
                              </div>
                              <div className="font-mono font-bold">{dollars(split.amount_cents + split.tax_cents)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {meta?.total
                ? `Showing ${meta.from ?? 0}-${meta.to ?? 0} of ${meta.total}`
                : 'No rows'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
                disabled={!meta || meta.current_page <= 1 || transactionsQ.isFetching}
                onClick={() => setPage((old) => Math.max(1, old - 1))}
              >
                Previous
              </button>
              <span className="min-w-20 text-center font-semibold">
                Page {meta?.current_page ?? page} of {meta?.last_page ?? 1}
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
                disabled={!meta || meta.current_page >= meta.last_page || transactionsQ.isFetching}
                onClick={() => setPage((old) => old + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  )
}
