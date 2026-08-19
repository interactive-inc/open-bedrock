import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import type { OrganizationUnitId } from "@/contexts/company/domain/workforce/workforce-id"

export function toWorkforceOrganizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", `department:${value}`)
}
