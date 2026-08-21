import type { OrganizationUnitPeriod } from "@/contexts/company/domain/values/organization-unit.definition"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/values/workforce-schedule.definition"

export type OrganizationChangeVersionedPeriod =
  | OrganizationUnitPeriod
  | OrgAssignmentPeriod
  | OrgResponsibilityPeriod
