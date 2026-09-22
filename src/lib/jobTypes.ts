import { apiRequest } from '@/lib/api'
import type {
  JobType,
  JobTypeInput,
  JobTypeUpdateInput,
  JobTypeListParams,
  PaginatedResponse,
  ResourceResponse,
} from '@/types/jobType'

/**
 * GET /v1/job-types — paginated list with filters.
 */
export async function listJobTypes(
  params: JobTypeListParams = {}
): Promise<PaginatedResponse<JobType>> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const path = '/v1/job-types' + (query.toString() ? `?${query.toString()}` : '')
  return apiRequest<PaginatedResponse<JobType>>(path)
}

/**
 * GET /v1/job-types/{id} — single job type.
 */
export async function getJobType(id: string): Promise<JobType> {
  const response = await apiRequest<ResourceResponse<JobType>>(`/v1/job-types/${id}`)
  return response.data
}

/**
 * POST /v1/job-types — create a new job type.
 */
export async function createJobType(input: JobTypeInput): Promise<JobType> {
  const response = await apiRequest<ResourceResponse<JobType>>('/v1/job-types', {
    method: 'POST',
    body: input,
  })
  return response.data
}

/**
 * PATCH /v1/job-types/{id} — partial update.
 */
export async function updateJobType(
  id: string,
  input: JobTypeUpdateInput
): Promise<JobType> {
  const response = await apiRequest<ResourceResponse<JobType>>(`/v1/job-types/${id}`, {
    method: 'PATCH',
    body: input,
  })
  return response.data
}

/**
 * DELETE /v1/job-types/{id} — soft delete.
 */
export async function deleteJobType(id: string): Promise<void> {
  await apiRequest<void>(`/v1/job-types/${id}`, {
    method: 'DELETE',
  })
}
