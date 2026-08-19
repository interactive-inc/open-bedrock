import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id"
import type { Context } from "@/env"

/** canonical Assignmentから指定時点の一意な直属上長を解決する。 */
export async function resolveDirectManagerId(
  c: Context,
  targetEmployeeId: number,
  asOf: string,
): Promise<number | null | Error> {
  const snapshot = await readCanonicalOrganizationState(c, restoreCalendarDate(asOf))
  if (snapshot instanceof Error) return snapshot
  const target = snapshot.employees.find(
    (employee) => employee.employeeId === toWorkforceEmployeeId(targetEmployeeId),
  )
  const managerEmployeeId = target?.primaryAssignment?.managerEmployeeId ?? null
  return managerEmployeeId === null ? null : toStorageEmployeeId(managerEmployeeId)
}
