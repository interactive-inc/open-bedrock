import type { OrganizationRelation } from "@/contexts/company/domain/core/organization-relation"
import { organizationRelationIsActiveOn } from "@/contexts/company/domain/core/organization-relation-is-active-on"

export function organizationRelationsHaveManagementCycle(
  relations: ReadonlyArray<OrganizationRelation>,
  date: string,
): boolean {
  const managers = new Map<string, Set<string>>()
  for (const relation of relations) {
    if (!organizationRelationIsActiveOn(relation, date)) continue
    const employeeManagers = managers.get(relation.employeeId) ?? new Set<string>()
    employeeManagers.add(relation.managerEmployeeId)
    managers.set(relation.employeeId, employeeManagers)
  }

  for (const employeeId of managers.keys()) {
    const pending = [{ employeeId, path: new Set<string>() }]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined) break
      if (current.path.has(current.employeeId)) return true
      const path = new Set(current.path).add(current.employeeId)
      for (const managerEmployeeId of managers.get(current.employeeId) ?? []) {
        pending.push({ employeeId: managerEmployeeId, path })
      }
    }
  }
  return false
}
