import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function toWorkforceOrganizationUnitId(value: string): OrganizationUnitId {
  return restoreWorkforceId("organization_unit", `department:${value}`)
}
