import { useState } from 'react'
import {
  usePaymentTerms,
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useDeletePaymentTerm,
  type PaymentTerm,
  type PaymentTermInput,
} from '@/hooks/usePaymentTerms'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'

/**
 * Payment Terms settings — tenant-defined billing terms.
 *
 * Each row = a named term (COD, NET 14, NET 30, custom). The starred
 * row is the tenant default; gets applied to new customers who don't
 * pick a per-customer term.
 *
 * "+ Add common terms" seeds a useful starter set in one click for
 * fresh tenants. Once they have rows, they can star/unstar, edit
 * days, or delete.
 */
export function PaymentTermsPage() {
  const { data: terms = [], isLoading } = usePaymentTerms()
  const update = useUpdatePaymentTerm()
  const remove = useDeletePaymentTerm()
  const create = useCreatePaymentTerm()
  const [editing, setEditing] = useState<PaymentTerm | null>(null)
  const [creating, setCreating] = useState(false)

  function toggleDefault(t: PaymentTerm) {
    update.mutate({ id: t.id, input: { is_default: !t.is_default } })
  }

  async function seedDefaults() {
    // Common-American-shop starter set. Inserts one at a time so
    // the model's single-default invariant settles cleanly.
    const seeds: PaymentTermInput[] = [
      { name: 'COD', days_until_due: 0, sort_order: 0, is_default: true },
      { name: 'NET 14', days_until_due: 14, sort_order: 10 },
      { name: 'NET 30', days_until_due: 30, sort_order: 20 },
      { name: 'NET 60', days_until_due: 60, sort_order: 30 },
    ]
    for (const s of seeds) {
      try {
        await create.mutateAsync(s)
      } catch {
        // Ignore — likely duplicate name or other validation. Single
        // failure shouldn't block the others.
      }
    }
  }

  async function deleteTerm(t: PaymentTerm) {
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await remove.mutateAsync(t.id)
    } catch {
      // Cancelled or failed.
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Payment Terms</h1>
          <p className="text-sm text-slate-600 mt-1">
            Define your billing terms. Each customer can be assigned a term;
            the invoice creator uses it to set the due date automatically.
            Star one as the default for new customers.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="whitespace-nowrap shrink-0">
          + New term
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
      ) : terms.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <p className="text-sm text-slate-600">
            No payment terms configured. Most shops use COD plus a few NET options.
          </p>
          <Button onClick={seedDefaults} loading={create.isPending}>
            + Add common terms (COD, NET 14, NET 30, NET 60)
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Name</Table.HeadCell>
                <Table.HeadCell align="right">Days until due</Table.HeadCell>
                <Table.HeadCell>Description</Table.HeadCell>
                <Table.HeadCell> </Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {terms.map((t) => (
                <Table.Row key={t.id} className="hover:bg-slate-50">
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleDefault(t)}
                        disabled={update.isPending}
                        className={`text-xl leading-none disabled:opacity-50 transition-colors ${
                          t.is_default
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-amber-400'
                        }`}
                        title={
                          t.is_default
                            ? 'Tenant default — click to clear'
                            : 'Make this the tenant default for new customers'
                        }
                        aria-label={t.is_default ? 'Clear tenant default' : 'Make tenant default'}
                      >
                        {t.is_default ? '★' : '☆'}
                      </button>
                      <div>
                        <div className="font-medium text-slate-900">{t.name}</div>
                        {!t.active && <Badge tone="neutral">inactive</Badge>}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell align="right" className="font-mono text-slate-900">
                    {t.days_until_due === 0 ? 'Due on receipt' : `${t.days_until_due} days`}
                  </Table.Cell>
                  <Table.Cell className="text-slate-700">{t.description || '—'}</Table.Cell>
                  <Table.Cell align="right" className="space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="text-sm text-slate-600 hover:text-amber-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTerm(t)}
                      className="text-sm text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      )}

      {creating && <PaymentTermModal onClose={() => setCreating(false)} mode="create" />}
      {editing && (
        <PaymentTermModal term={editing} onClose={() => setEditing(null)} mode="edit" />
      )}
    </div>
  )
}

function PaymentTermModal({
  term,
  onClose,
  mode,
}: {
  term?: PaymentTerm
  onClose: () => void
  mode: 'create' | 'edit'
}) {
  const [name, setName] = useState(term?.name ?? '')
  const [days, setDays] = useState<string>(String(term?.days_until_due ?? 0))
  const [description, setDescription] = useState(term?.description ?? '')
  const [active, setActive] = useState(term?.active ?? true)
  const create = useCreatePaymentTerm()
  const update = useUpdatePaymentTerm()
  const [err, setErr] = useState<string | null>(null)
  const saving = create.isPending || update.isPending

  async function save() {
    setErr(null)
    const input: PaymentTermInput = {
      name: name.trim(),
      days_until_due: parseInt(days, 10) || 0,
      description: description.trim() || null,
      active,
    }
    if (!input.name) {
      setErr('Name is required.')
      return
    }
    try {
      if (mode === 'edit' && term) {
        await update.mutateAsync({ id: term.id, input })
      } else {
        await create.mutateAsync(input)
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.')
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={mode === 'edit' ? `Edit: ${term?.name}` : 'New payment term'}
      disableBackdropClose
    >
      <Modal.Body className="space-y-3">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="NET 30"
        />
        <Input
          label="Days until due (0 = COD / due on receipt)"
          type="number"
          min={0}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor="pt-desc" className="block text-sm font-medium text-navy-700">
            Description (optional)
          </label>
          <textarea
            id="pt-desc"
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-white border border-navy-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-navy-800"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>Active</span>
        </label>
        {err && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {err}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
