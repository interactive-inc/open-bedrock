import type {
  ValidateWorkforceLifecycleScheduleProps,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/workforce/workforce-invariant"
import { validateWorkforceAssignments } from "@/contexts/company/domain/workforce/validate-workforce-assignments"
import { validateWorkforceEmploymentStatuses } from "@/contexts/company/domain/workforce/validate-workforce-employment-statuses"
import { validateWorkforceLifecycleOwner } from "@/contexts/company/domain/workforce/validate-workforce-lifecycle-owner"
import { validateWorkforcePeriodVersions } from "@/contexts/company/domain/workforce/validate-workforce-period-versions"
import { validateWorkforceResponsibilities } from "@/contexts/company/domain/workforce/validate-workforce-responsibilities"

export function validateWorkforceLifecycleSchedule(
  props: ValidateWorkforceLifecycleScheduleProps,
): WorkforceInvariantViolation | null {
  return (
    validateWorkforceLifecycleOwner(props.schedule) ??
    validateWorkforcePeriodVersions(props.schedule) ??
    validateWorkforceEmploymentStatuses(props.schedule) ??
    validateWorkforceAssignments(props.schedule, props.organizationUnitPeriods) ??
    validateWorkforceResponsibilities([props.schedule], props.organizationUnitPeriods)
  )
}
