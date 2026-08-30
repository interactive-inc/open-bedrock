import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"

export async function loadCurrentEmployeeDepartmentNames(
  c: Context,
  employeeIds: ReadonlyArray<EmployeeId>,
): Promise<ReadonlyMap<EmployeeId, string | null> | Error> {
  const snapshot = await new ReadCanonicalOrganizationStateAdapter(
    c,
  ).readCanonicalOrganizationState()
  if (snapshot instanceof Error) return snapshot
  const requested = new Set(employeeIds)
  const unitNameById = new Map(
    snapshot.organization.units.map(
      (unit) => [unit.organizationUnitId, unit.officialName] as const,
    ),
  )
  const names = new Map<EmployeeId, string | null>()
  for (const employee of snapshot.employees) {
    if (!requested.has(employee.employeeId)) continue
    names.set(
      employee.employeeId,
      employee.primaryAssignment === null
        ? null
        : (unitNameById.get(employee.primaryAssignment.organizationUnitId) ?? null),
    )
  }
  return names
}
