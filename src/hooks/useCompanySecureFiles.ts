import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCompanySecureNote,
  deleteCompanySecureFile,
  getCompanySecureFileStatus,
  listCompanySecureFileAudit,
  listCompanySecureFiles,
  recoverCompanySecureFileKey,
  requestCompanySecureFileAccess,
  rotateCompanySecureFileRecoveryKey,
  setupCompanySecureFiles,
  updateCompanySecureFile,
  uploadCompanySecureFile,
  verifyCompanySecureFileAccess,
} from '@/lib/companySecureFiles'

export const companySecureFileKeys = {
  status: () => ['company-secure-files', 'status'] as const,
  list: () => ['company-secure-files', 'list'] as const,
  audit: (fileId: string) => ['company-secure-files', 'audit', fileId] as const,
}

export function useCompanySecureFileStatus() {
  return useQuery({
    queryKey: companySecureFileKeys.status(),
    queryFn: () => getCompanySecureFileStatus(),
  })
}

export function useCompanySecureFiles() {
  return useQuery({
    queryKey: companySecureFileKeys.list(),
    queryFn: () => listCompanySecureFiles(),
  })
}

export function useSetupCompanySecureFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => setupCompanySecureFiles(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.status() })
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useRotateCompanySecureFileRecoveryKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rotateCompanySecureFileRecoveryKey(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.status() })
    },
  })
}

export function useRecoverCompanySecureFileKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recoveryKey: string) => recoverCompanySecureFileKey(recoveryKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.status() })
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useRequestCompanySecureFileAccess() {
  return useMutation({
    mutationFn: (channel: 'sms' | 'email') => requestCompanySecureFileAccess(channel),
  })
}

export function useVerifyCompanySecureFileAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => verifyCompanySecureFileAccess(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.status() })
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useUploadCompanySecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, title, description }: { file: File; title?: string; description?: string }) =>
      uploadCompanySecureFile(file, title, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useCreateCompanySecureNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ title, body, description }: { title: string; body: string; description?: string }) =>
      createCompanySecureNote(title, body, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useUpdateCompanySecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      fileId,
      title,
      description,
      body,
    }: {
      fileId: string
      title?: string
      description?: string | null
      body?: string
    }) => updateCompanySecureFile(fileId, { title, description, body }),
    onSuccess: (_res, { fileId }) => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
      qc.invalidateQueries({ queryKey: companySecureFileKeys.audit(fileId) })
    },
  })
}

export function useDeleteCompanySecureFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => deleteCompanySecureFile(fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companySecureFileKeys.list() })
    },
  })
}

export function useCompanySecureFileAudit(fileId: string | null) {
  return useQuery({
    queryKey: fileId ? companySecureFileKeys.audit(fileId) : ['company-secure-files', 'audit', 'none'],
    queryFn: () => listCompanySecureFileAudit(fileId as string),
    enabled: !!fileId,
  })
}
