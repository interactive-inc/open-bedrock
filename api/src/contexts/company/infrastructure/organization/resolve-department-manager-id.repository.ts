import { readCanonicalOrganizationState } from "@/contexts/company/infrastructure/organization/read-canonical-organization-state.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"
import { toStorageEmployeeId } from "@/contexts/company/infrastructure/workforce/to-storage-employee-id.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"

/** canonical AssignmentとMANAGER Responsibilityから指定時点の一意な部門長を解決する。 */
export async function resolveDepartmentManagerId(
  c: CompanyContext,
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
