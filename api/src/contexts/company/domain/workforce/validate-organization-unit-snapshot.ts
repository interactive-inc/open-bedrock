import { isCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import {
  periodContainsDate,
  workforcePeriodContainsPeriod,
  workforcePeriodsOverlap,
} from "@/contexts/company/domain/workforce/effective-period"
import {
  organizationUnitKinds,
  type OrganizationUnitPeriod,
  type OrganizationUnitSnapshot,
} from "@/contexts/company/domain/workforce/organization-unit"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationUnitId } from "@/contexts/company/domain/workforce/workforce-id"

export const organizationInvariantCodes = [
  "invalid_snapshot",
  "invalid_period",
  "duplicate_period",
  "organization_unit_overlap",
  "organization_code_overlap",
  "invalid_parent",
  "parent_not_active",
  "hierarchy_cycle",
] as const

export type OrganizationInvariantCode = (typeof organizationInvariantCodes)[number]

export type OrganizationInvariantViolation = Readonly<{
  code: OrganizationInvariantCode
  message: string
}>

function violation(
  code: OrganizationInvariantCode,
  message: string,
): OrganizationInvariantViolation {
  return { code, message }
}

function activePeriods(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<OrganizationUnitPeriod> {
  return periods.filter((period) => !period.isVoid)
}

function validText(value: string, maximumLength: number): boolean {
  return value.length >= 1 && value.length <= maximumLength && value.trim() === value
}

function validatePeriods(
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
      !validText(period.code, 64) ||
      !validText(period.officialName, 200) ||
      !organizationUnitKinds.includes(period.kind)
    ) {
      return violation("invalid_period", "organization unit period is not canonical")
    }
    if (periodIds.has(period.periodId)) {
      return violation(
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
      return violation("invalid_parent", "organization unit has an invalid parent")
    }
  }
  return null
}

function validateOverlaps(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const [index, left] of periods.entries()) {
    for (const right of periods.slice(index + 1)) {
      if (!workforcePeriodsOverlap(left, right)) continue
      if (left.organizationUnitId === right.organizationUnitId) {
        return violation("organization_unit_overlap", "organization unit periods overlap")
      }
      if (left.code === right.code) {
        return violation("organization_code_overlap", "organization unit codes overlap")
      }
      if (left.kind === "COMPANY" && right.kind === "COMPANY") {
        return violation("organization_unit_overlap", "company root periods overlap")
      }
    }
  }
  return null
}

function validateParents(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const child of periods) {
    if (child.parentOrganizationUnitId === null) continue
    const parent = periods.find(
      (candidate) =>
        candidate.organizationUnitId === child.parentOrganizationUnitId &&
        workforcePeriodContainsPeriod(candidate, child),
    )
    if (parent === undefined) {
      return violation(
        "parent_not_active",
        "parent organization unit is not active for the full child period",
      )
    }
  }
  return null
}

function boundaryDates(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<CalendarDate> {
  return [
    ...new Set(
      periods.flatMap((period) => [
        period.startsOn,
        ...(period.endsOn === null ? [] : [period.endsOn]),
      ]),
    ),
  ].sort()
}

function hasCycleAt(periods: ReadonlyArray<OrganizationUnitPeriod>, date: CalendarDate): boolean {
  const parents = new Map<OrganizationUnitId, OrganizationUnitId>()
  for (const period of periods) {
    if (periodContainsDate(period, date) && period.parentOrganizationUnitId !== null) {
      parents.set(period.organizationUnitId, period.parentOrganizationUnitId)
    }
  }

  for (const unitId of parents.keys()) {
    const path = new Set<OrganizationUnitId>()
    let current: OrganizationUnitId | undefined = unitId
    while (current !== undefined) {
      if (path.has(current)) return true
      path.add(current)
      current = parents.get(current)
    }
  }
  return false
}

/** OrgUnitの最新revision projectionを全期間についてfail closedで検証する。 */
export function validateOrganizationUnitSnapshot(
  snapshot: OrganizationUnitSnapshot,
): OrganizationInvariantViolation | null {
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !isCalendarDate(snapshot.asOf)
  ) {
    return violation("invalid_snapshot", "organization snapshot is not canonical")
  }

  const periods = activePeriods(snapshot.units)
  return (
    validatePeriods(snapshot.units) ??
    validateOverlaps(periods) ??
    validateParents(periods) ??
    (boundaryDates(periods).some((date) => hasCycleAt(periods, date))
      ? violation("hierarchy_cycle", "organization hierarchy contains a cycle")
      : null)
  )
}
