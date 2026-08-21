import type { OrganizationChangeSet } from "@/contexts/company/domain/workforce/organization-change"

export function countOrganizationChangePeriods(change: OrganizationChangeSet): number {
  return change.unitPeriods.length + change.assignments.length + change.responsibilities.length
}
