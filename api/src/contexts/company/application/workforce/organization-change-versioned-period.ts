import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/workforce/workforce-schedule"

export type OrganizationChangeVersionedPeriod =
  | OrganizationUnitPeriod
  | OrgAssignmentPeriod
  | OrgResponsibilityPeriod
