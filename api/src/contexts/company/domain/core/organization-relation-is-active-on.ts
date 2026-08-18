import type { OrganizationRelation } from "@/contexts/company/domain/core/organization-relation"

export function organizationRelationIsActiveOn(
  relation: OrganizationRelation,
  date: string,
): boolean {
  return relation.startsOn <= date && (relation.endsOn === null || date < relation.endsOn)
}
