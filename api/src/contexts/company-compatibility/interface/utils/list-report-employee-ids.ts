import type { Context } from "@/env"
import { readCanonicalOrganizationState } from "@/contexts/company-compatibility/application/organization/read-canonical-organization-state"
import { toWorkforceEmployeeId } from "@/contexts/company-compatibility/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { listReportWorkforceEmployeeIds } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import { toStorageEmployeeId } from "@/contexts/company-compatibility/infrastructure/workforce/to-storage-employee-id"

export type Props = {
  c: Context
  viewerEmployeeId: number
}

/**
 * viewer の配下(再帰)にあたる従業員 id をcanonical Company snapshotから解決する。
 * viewer 自身は含めない。
 */
export async function listReportEmployeeIds(props: Props): Promise<Array<number> | Error> {
  const snapshot = await readCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot

  const storageIds: number[] = []
  for (const employeeId of listReportWorkforceEmployeeIds({
    states: snapshot.employees,
    actorEmployeeId: toWorkforceEmployeeId(props.viewerEmployeeId),
  })) {
    const storageId = toStorageEmployeeId(employeeId)
    if (storageId instanceof Error) return storageId
    storageIds.push(storageId)
  }
  return storageIds.toSorted((left, right) => left - right)
}
