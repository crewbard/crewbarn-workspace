import { useParams } from 'react-router-dom'
import { InvoiceDetail } from '@/components/invoices/InvoiceDetail'
import { useTheme } from '@/hooks/useTheme'

/** /invoices/:id — the same detail the job page shows in its overlay. */
export default function InvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { theme } = useTheme()

  return <InvoiceDetail invoiceId={id} presentation={theme === 'easy-side' || theme === 'easy-top' ? 'easy' : 'standard'} />
}
