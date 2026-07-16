import type { Context } from "@/env"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"

export async function loadCurrentEmployeeDepartmentNames(
  c: Context,
  employeeIds: ReadonlyArray<number>,
): Promise<{ source: "lifecycle" | "legacy"; names: ReadonlyMap<number, string | null> } | Error> {
  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) return organization
  const requested = new Set(employeeIds)
  const departmentNameByCode = new Map(
    organization.departments.map((department) => [department.code, department.name] as const),
  )
  const names = new Map<number, string | null>()
  for (const employee of organization.employeesByCode.values()) {
    if (!requested.has(employee.id)) continue
    names.set(
      employee.id,
      employee.primaryDepartmentCode === null
        ? null
        : (departmentNameByCode.get(employee.primaryDepartmentCode) ?? null),
    )
  }
  return { source: organization.source, names }
}
