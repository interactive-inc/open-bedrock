import type { CompanyResource } from "@/contexts/company/domain/core/company-resource"
import { readCompanyResourceText } from "@/contexts/company/domain/core/read-company-resource-text"
import { readNullableCompanyResourceText } from "@/contexts/company/domain/core/read-nullable-company-resource-text"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"

export function toOrganizationUnitPeriod(resource: CompanyResource): OrganizationUnitPeriod | null {
  const organizationUnitId = readCompanyResourceText(resource.attributes, "organizationUnitId")
  const code = readCompanyResourceText(resource.attributes, "code")
  const officialName = readCompanyResourceText(resource.attributes, "officialName")
  const kind = readCompanyResourceText(resource.attributes, "kind")
  const parentOrganizationUnitId = readNullableCompanyResourceText(
    resource.attributes,
    "parentOrganizationUnitId",
  )
  if (
    organizationUnitId === null ||
    code === null ||
    officialName === null ||
    kind === null ||
    parentOrganizationUnitId === undefined
  ) {
    return null
  }
  try {
    return {
      periodId: restoreWorkforceId("period", resource.id),
      revision: resource.revision,
      startsOn: resource.effectiveFrom,
      endsOn: resource.effectiveTo,
      isVoid: resource.state === "void",
      recordedByActionId: restoreWorkforceId("personnel_action", "company-resource:stored"),
      recordedAt: 0,
      organizationUnitId: restoreWorkforceId("organization_unit", organizationUnitId),
      code,
      officialName,
      kind: kind as OrganizationUnitPeriod["kind"],
      parentOrganizationUnitId:
        parentOrganizationUnitId === null
          ? null
          : restoreWorkforceId("organization_unit", parentOrganizationUnitId),
    }
  } catch {
    return null
  }
}
