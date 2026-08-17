import { readCanonicalOrganizationState } from "@/contexts/company/application/organization/read-canonical-organization-state"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
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

/** canonical AssignmentとMANAGER Responsibilityから指定時点の一意な部門長を解決する。 */
export async function resolveDepartmentManagerId(
  c: Context,
  targetEmployeeId: number,
  asOf: string,
): Promise<number | null | Error> {
  const snapshot = await readCanonicalOrganizationState(c, restoreCalendarDate(asOf))
  if (snapshot instanceof Error) return snapshot
  const target = snapshot.employees.find(
    (employee) => employee.employeeId === toWorkforceEmployeeId(targetEmployeeId),
  )
  const organizationUnitId = target?.primaryAssignment?.organizationUnitId
  if (organizationUnitId === undefined) return null

  const managers = snapshot.employees.flatMap((employee) =>
    employee.responsibilities.some(
      (responsibility) =>
        responsibility.responsibilityType === "MANAGER" &&
        responsibility.organizationUnitId === organizationUnitId,
    )
      ? [employee.employeeId]
      : [],
  )
  if (managers.length > 1) return new Error("organization manager is ambiguous")
  return managers[0] === undefined ? null : toStorageEmployeeId(managers[0])
}
