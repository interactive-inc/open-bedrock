import { createOrganizationInvariantViolation } from "@/contexts/company/domain/workforce/create-organization-invariant-violation"
import { isCalendarDate } from "@/contexts/company/domain/workforce/is-calendar-date"
import { isValidOrganizationUnitText } from "@/contexts/company/domain/workforce/is-valid-organization-unit-text"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/organization-invariant"
import {
  organizationUnitKinds,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/workforce/organization-unit"

export function validateOrganizationUnitPeriods(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  const periodIds = new Set<string>()

  for (const period of periods) {
    if (
      !Number.isSafeInteger(period.revision) ||
      period.revision < 1 ||
      !Number.isSafeInteger(period.recordedAt) ||
      period.recordedAt < 0 ||
      !isCalendarDate(period.startsOn) ||
      (period.endsOn !== null &&
        (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn)) ||
      !isValidOrganizationUnitText(period.code, 64) ||
      !isValidOrganizationUnitText(period.officialName, 200) ||
      !organizationUnitKinds.includes(period.kind)
    ) {
      return createOrganizationInvariantViolation(
        "invalid_period",
        "organization unit period is not canonical",
      )
    }
    if (periodIds.has(period.periodId)) {
      return createOrganizationInvariantViolation(
        "duplicate_period",
        "organization snapshot contains more than one latest period version",
      )
    }
    periodIds.add(period.periodId)

    const parentIsValid =
      period.kind === "COMPANY"
        ? period.parentOrganizationUnitId === null
        : period.parentOrganizationUnitId !== null &&
          period.parentOrganizationUnitId !== period.organizationUnitId
    if (!parentIsValid) {
      return createOrganizationInvariantViolation(
        "invalid_parent",
        "organization unit has an invalid parent",
      )
    }
  }
  return null
}
