import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import { listManagedWorkforceEmployeeIds } from "@/contexts/company/domain/policies/list-managed-workforce-employee-ids.policy"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id.repository"
import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
export async function listManagedEmployeeIds(
  c: CompanyContext,
  actorEmployeeId: number,
  asOf?: CalendarDate,
): Promise<ReadonlyArray<number> | Error> {
  const snapshot = await readCanonicalOrganizationState(c, asOf)
  if (snapshot instanceof Error) return snapshot

  const employeeIds = listManagedWorkforceEmployeeIds({
    states: snapshot.employees,
    actorEmployeeId: toWorkforceEmployeeId(actorEmployeeId),
  })
  const storageIds: number[] = []
  for (const employeeId of employeeIds) {
    const storageId = toStorageEmployeeId(employeeId)
    if (storageId instanceof Error) return storageId
    storageIds.push(storageId)
  }
  return storageIds.toSorted((left, right) => left - right)
}
