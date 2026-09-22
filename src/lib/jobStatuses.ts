import { apiRequest } from '@/lib/api'
import type {
  JobStatus,
  JobStatusInput,
  JobStatusUpdateInput,
  JobStatusListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/jobStatus'

/**
 * GET /v1/job-statuses — paginated list with filters.
 */
export async function listJobStatuses(
  params: JobStatusListParams = {}
): Promise<PaginatedResponse<JobStatus>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/job-statuses' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<JobStatus>>(path)
}

/**
 * GET /v1/job-statuses/{id} — single job status.
 */
export async function getJobStatus(id: string): Promise<JobStatus> {
  const response = await apiRequest<ResourceResponse<JobStatus>>(`/v1/job-statuses/${id}`)
  return response.data
}

/**
 * POST /v1/job-statuses — create a new job status.
 */
export async function createJobStatus(input: JobStatusInput): Promise<JobStatus> {
  const response = await apiRequest<ResourceResponse<JobStatus>>('/v1/job-statuses', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/job-statuses/{id} — partial update.
 */
export async function updateJobStatus(
  id: string,
  input: JobStatusUpdateInput
): Promise<JobStatus> {
  const response = await apiRequest<ResourceResponse<JobStatus>>(`/v1/job-statuses/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/job-statuses/{id} — soft delete.
 */
export async function deleteJobStatus(id: string): Promise<void> {
  await apiRequest<void>(`/v1/job-statuses/${id}`, {
    method: 'DELETE',
  })
}
