import {
  fetchRegionalResponseDepartmentTasks,
  type CompiledRecordRow,
  type DepartmentTaskRow,
  type RegionalResponseRow,
} from '../api/lists'
import { hasDepartmentResponse } from './departmentTaskWorkflow'

export type CompiledRecordRegionBlock = {
  regionName: string
  tasks: DepartmentTaskRow[]
}

export function findRegionalResponseForRegion(
  responses: RegionalResponseRow[],
  reqId: string,
  regionName: string,
): RegionalResponseRow | null {
  const want = regionName.trim().toLowerCase()
  return (
    responses.find(
      (r) => r.req_id === reqId && (r.region_name ?? '').trim().toLowerCase() === want,
    ) ?? null
  )
}

export async function loadDepartmentTasksForRegion(
  reqId: string,
  regionName: string,
  responsesForReq: RegionalResponseRow[],
  ictFallbackTasks: DepartmentTaskRow[],
): Promise<DepartmentTaskRow[]> {
  const regional = findRegionalResponseForRegion(responsesForReq, reqId, regionName)
  if (regional) {
    const tasks = await fetchRegionalResponseDepartmentTasks(regional.id)
    return tasks.filter((t) => hasDepartmentResponse(t))
  }
  const key = regionName.trim()
  return ictFallbackTasks.filter(
    (t) => t.req_id === reqId && (t.region_name ?? '').trim() === key && hasDepartmentResponse(t),
  )
}

export async function loadCompiledRecordRegionBlocks(
  record: CompiledRecordRow,
  regionalResponses: RegionalResponseRow[],
  indexTasks: DepartmentTaskRow[],
): Promise<CompiledRecordRegionBlock[]> {
  const reqId = record.req_id
  const regions = record.region_names ?? []
  if (!reqId || regions.length === 0) return []

  const responsesForReq = regionalResponses.filter((r) => r.req_id === reqId)
  return Promise.all(
    regions.map(async (regionName) => {
      const tasks = await loadDepartmentTasksForRegion(
        reqId,
        regionName,
        responsesForReq,
        indexTasks,
      )
      return { regionName: regionName.trim(), tasks }
    }),
  )
}
