import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCustomerDocuments,
  uploadCustomerDocument,
  deleteCustomerDocument,
} from '@/lib/customerDocuments'

export const customerDocumentKeys = {
  all: ['customer-documents'] as const,
  list: (customerId: string) => ['customer-documents', 'list', customerId] as const,
}

export function useCustomerDocuments(customerId: string) {
  return useQuery({
    queryKey: customerDocumentKeys.list(customerId),
    queryFn: () => listCustomerDocuments(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  })
}

export function useUploadCustomerDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      file,
      title,
    }: {
      customerId: string
      file: File
      title?: string
    }) => uploadCustomerDocument(customerId, file, title),
    onSuccess: (_doc, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerDocumentKeys.list(customerId) })
    },
  })
}

export function useDeleteCustomerDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      documentId,
    }: {
      customerId: string
      documentId: string
    }) => deleteCustomerDocument(customerId, documentId),
    onSuccess: (_v, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerDocumentKeys.list(customerId) })
    },
  })
}
