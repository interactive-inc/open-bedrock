import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

/** canonical Assignmentから指定時点の一意な直属上長を解決する。 */
export async function resolveDirectManagerId(
  c: CompanyContext,
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
