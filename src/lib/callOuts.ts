import { apiRequest } from '@/lib/api'

/**
 * Automated calls CrewBarn placed about a job (today: "you're running late"
 * to the tech) and how each went, as Twilio reported it.
 */
export interface CallOut {
  id: string
  work_order_id: string
  /** late_alert */
  kind: string
  /** tech | customer */
  audience: 'tech' | 'customer'
  /** "Pressed 1 and was connected to the customer" */
  pressed: string | null
  /** Who pressed Call customer, when the office started it. */
  started_by_name: string | null
  account_id: string | null
  account_name: string | null
  to_number: string
  /** ai | standard | null when it never went out */
  voice: string | null
  message: string | null
  /** queued | ringing | in-progress | completed | busy | no-answer | failed | canceled */
  status: string
  /** In words: "Answered, 0:24", "No answer", "Didn’t go through". */
  outcome: string
  answered_at: string | null
  duration_seconds: number | null
  ended_at: string | null
  created_at: string | null
}

export async function listCallOuts(workOrderId: string): Promise<CallOut[]> {
  return (await apiRequest<{ data: CallOut[] }>(`/v1/work-orders/${workOrderId}/call-outs`)).data
}
