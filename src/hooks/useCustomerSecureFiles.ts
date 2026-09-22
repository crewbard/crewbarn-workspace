import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomerSecureNote,
  deleteCustomerSecureFile,
  getSecureFileStatus,
  listCustomerSecureFileAudit,
  listCustomerSecureFiles,
  recoverSecureFileKey,
  requestSecureFileAccess,
  rotateSecureFileRecoveryKey,
  setupSecureFiles,
  updateCustomerSecureFile,
  uploadCustomerSecureFile,
  verifySecureFileAccess,
} from '@/lib/customerSecureFiles'

export const customerSecureFileKeys = {
  status: (customerId: string) => ['customer-secure-files', 'status', customerId] as const,
  list: (customerId: string) => ['customer-secure-files', 'list', customerId] as const,
  audit: (customerId: string, fileId: string) => ['customer-secure-files', 'audit', customerId, fileId] as const,
}

export function useCustomerSecureFileStatus(customerId: string) {
  return useQuery({
    queryKey: customerSecureFileKeys.status(customerId),
    queryFn: () => getSecureFileStatus(customerId),
    enabled: !!customerId,
  })
}

export function useCustomerSecureFiles(customerId: string) {
  return useQuery({
    queryKey: customerSecureFileKeys.list(customerId),
    queryFn: () => listCustomerSecureFiles(customerId),
    enabled: !!customerId,
  })
}

export function useSetupSecureFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (customerId: string) => setupSecureFiles(customerId),
    onSuccess: (_res, customerId) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.status(customerId) })
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useRotateSecureFileRecoveryKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (customerId: string) => rotateSecureFileRecoveryKey(customerId),
    onSuccess: (_res, customerId) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.status(customerId) })
    },
  })
}

export function useRecoverSecureFileKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, recoveryKey }: { customerId: string; recoveryKey: string }) =>
      recoverSecureFileKey(customerId, recoveryKey),
    onSuccess: (_res, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.status(customerId) })
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useRequestSecureFileAccess() {
  return useMutation({
    mutationFn: ({ customerId, channel }: { customerId: string; channel: 'sms' | 'email' }) =>
      requestSecureFileAccess(customerId, channel),
  })
}

export function useVerifySecureFileAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, code }: { customerId: string; code: string }) =>
      verifySecureFileAccess(customerId, code),
    onSuccess: (_res, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.status(customerId) })
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useUploadCustomerSecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, file, title, description }: { customerId: string; file: File; title?: string; description?: string }) =>
      uploadCustomerSecureFile(customerId, file, title, description),
    onSuccess: (_res, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useCreateCustomerSecureNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, title, body, description }: { customerId: string; title: string; body: string; description?: string }) =>
      createCustomerSecureNote(customerId, title, body, description),
    onSuccess: (_res, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useUpdateCustomerSecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      fileId,
      title,
      description,
      body,
    }: {
      customerId: string
      fileId: string
      title?: string
      description?: string | null
      body?: string
    }) => updateCustomerSecureFile(customerId, fileId, { title, description, body }),
    onSuccess: (_res, { customerId, fileId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.audit(customerId, fileId) })
    },
  })
}

export function useDeleteCustomerSecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, fileId }: { customerId: string; fileId: string }) => deleteCustomerSecureFile(customerId, fileId),
    onSuccess: (_res, { customerId }) => {
      qc.invalidateQueries({ queryKey: customerSecureFileKeys.list(customerId) })
    },
  })
}

export function useCustomerSecureFileAudit(customerId: string, fileId: string | null) {
  return useQuery({
    queryKey: fileId ? customerSecureFileKeys.audit(customerId, fileId) : ['customer-secure-files', 'audit', customerId, 'none'],
    queryFn: () => listCustomerSecureFileAudit(customerId, fileId as string),
    enabled: !!customerId && !!fileId,
  })
}
