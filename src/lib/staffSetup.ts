export type StaffSetupPreview = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; tenant_name: string | null; requires_password: boolean; secure_vault_ready: boolean; completed?: boolean }
export type StaffSetupCompletion = { ok: boolean; app_download_url?: string | null; app_download_delivery?: { email_sent: boolean; sms_sent: boolean } | null }

export function cleanSetupForm(form: HTMLFormElement): FormData {
  const body = new FormData(form)
  for (const [key, value] of [...body.entries()]) {
    if ((typeof value === 'string' && !value.trim()) || (value instanceof File && value.size === 0)) body.delete(key)
  }
  return body
}
