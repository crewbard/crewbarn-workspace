import { useParams } from 'react-router-dom'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'

/** /invoices/:id — the same detail the job page shows in its overlay. */
export default function InvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>()

  return <InvoiceDetail invoiceId={id} />
}
