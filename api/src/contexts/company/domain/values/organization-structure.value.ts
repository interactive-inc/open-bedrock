import type { WorkforcePeriodVersion } from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/values/organization-invariant.definition"
import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/values/is-calendar-date.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/values/workforce-id.definition"

export const organizationUnitKinds = ["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"] as const

export type OrganizationUnitKind = (typeof organizationUnitKinds)[number]

/**
 * OrgUnit identity に対する有効期間付きの名称・分類・親子関係。
 * 訂正は同じ periodId の新 revision、改組は新しい periodId として追記する。
 */
export type OrganizationUnitPeriod = WorkforcePeriodVersion &
  Readonly<{
    organizationUnitId: OrganizationUnitId
    code: string
    officialName: string
    kind: OrganizationUnitKind
    parentOrganizationUnitId: OrganizationUnitId | null
  }>

/** 一回のCompany組織解決で固定するOrgUnit projection。 */
export type OrganizationUnitSnapshot = Readonly<{
  revision: number
  asOf: CalendarDate
  units: ReadonlyArray<OrganizationUnitPeriod>
}>

function violation(
  code: OrganizationInvariantViolation["code"],
  message: string,
): OrganizationInvariantViolation {
  return Object.freeze({ code, message })
}

function isValidText(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && value.trim() === value
}

function containsPeriod(outer: WorkforcePeriodVersion, inner: WorkforcePeriodVersion): boolean {
  return (
    outer.startsOn <= inner.startsOn &&
    (outer.endsOn === null || (inner.endsOn !== null && inner.endsOn <= outer.endsOn))
  )
}

function periodsOverlap(left: WorkforcePeriodVersion, right: WorkforcePeriodVersion): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}

function containsDate(period: WorkforcePeriodVersion, date: CalendarDate): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

function freezePeriod(period: OrganizationUnitPeriod): OrganizationUnitPeriod {
  return Object.freeze({ ...period })
}

/**
 * 組織単位の全有効期間を一つの整合した組織構造として扱う集約ルート。
 */
export class OrganizationStructureValue {
  readonly revision: number
  readonly asOf: CalendarDate
  readonly units: ReadonlyArray<OrganizationUnitPeriod>

  private constructor(snapshot: OrganizationUnitSnapshot) {
    this.revision = snapshot.revision
    this.asOf = snapshot.asOf
    this.units = Object.freeze(snapshot.units.map(freezePeriod))
    Object.freeze(this)
  }

  static restore(
    snapshot: OrganizationUnitSnapshot,
  ): OrganizationStructureValue | OrganizationInvariantViolation {
    if (
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !isCalendarDate(snapshot.asOf)
    ) {
      return violation("invalid_snapshot", "organization snapshot is not canonical")
    }

    const periodIds = new Set<string>()
    for (const period of snapshot.units) {
      if (
        !Number.isSafeInteger(period.revision) ||
        period.revision < 1 ||
        !Number.isSafeInteger(period.recordedAt) ||
        period.recordedAt < 0 ||
        !isCalendarDate(period.startsOn) ||
        (period.endsOn !== null &&
          (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn)) ||
        !isValidText(period.code, 64) ||
        !isValidText(period.officialName, 200) ||
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

    const entity = new OrganizationStructureValue(snapshot)
    const activePeriods = entity.activePeriods
    for (const [index, left] of activePeriods.entries()) {
      for (const right of activePeriods.slice(index + 1)) {
        if (!periodsOverlap(left, right)) continue
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

    for (const child of activePeriods) {
      if (child.parentOrganizationUnitId === null) continue
      if (
        !activePeriods.some(
          (candidate) =>
            candidate.organizationUnitId === child.parentOrganizationUnitId &&
            containsPeriod(candidate, child),
        )
      ) {
        return violation(
          "parent_not_active",
          "parent organization unit is not active for the full child period",
        )
      }
    }

    if (entity.boundaryDates.some((date) => entity.hasHierarchyCycleAt(date))) {
      return violation("hierarchy_cycle", "organization hierarchy contains a cycle")
    }

    return entity
  }

  get activePeriods(): ReadonlyArray<OrganizationUnitPeriod> {
    return Object.freeze(this.units.filter((period) => !period.isVoid))
  }

  get boundaryDates(): ReadonlyArray<CalendarDate> {
    return Object.freeze(
      [
        ...new Set(
          this.activePeriods.flatMap((period) => [
            period.startsOn,
            ...(period.endsOn === null ? [] : [period.endsOn]),
          ]),
        ),
      ].sort(),
    )
  }

  containsUnitForPeriod(
    organizationUnitId: OrganizationUnitId,
    period: WorkforcePeriodVersion,
  ): boolean {
    return this.activePeriods.some(
      (unit) => unit.organizationUnitId === organizationUnitId && containsPeriod(unit, period),
    )
  }

  private hasHierarchyCycleAt(date: CalendarDate): boolean {
    const parents = new Map<OrganizationUnitId, OrganizationUnitId>()
    for (const period of this.activePeriods) {
      if (containsDate(period, date) && period.parentOrganizationUnitId !== null) {
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
}
