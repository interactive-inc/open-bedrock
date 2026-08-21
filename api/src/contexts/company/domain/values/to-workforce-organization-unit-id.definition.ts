import { restoreWorkforceId } from "@/contexts/company/domain/values/restore-workforce-id.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/values/workforce-id.definition"

export function toWorkforceOrganizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", `department:${value}`)
}
