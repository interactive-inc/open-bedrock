import type { Context } from "@/env"
import { listManagedWorkforceEmployeeIds } from "@/contexts/company/domain/workforce/resolve-employee-management-authority"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"

/** actor が管理できる社員IDを返す。受信箱の絞り込みに使う。 */
export async function listManagedEmployeeIds(
  c: Context,
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
