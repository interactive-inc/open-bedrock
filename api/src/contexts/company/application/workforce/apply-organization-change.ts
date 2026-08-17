import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import { validateWorkforceSchedules } from "@/contexts/company/domain/workforce/validate-workforce-schedules"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforceSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import type {
  OrganizationUnitId,
  PersonnelActionId,
} from "@/contexts/company/domain/workforce/workforce-id"
import type { OrganizationUnitReadPort } from "@/contexts/company/application/workforce/read-organization-state"

type OrganizationUnitIdentity = Readonly<{
  id: OrganizationUnitId
  createdAt: number
}>

export type OrganizationChangeSet = Readonly<{
  operationId: PersonnelActionId
  expectedRevision: number
  asOf: CalendarDate
  recordedAt: number
  organizationUnits: ReadonlyArray<OrganizationUnitIdentity>
  unitPeriods: ReadonlyArray<OrganizationUnitPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

export type WorkforceSnapshotReadResult =
  | Readonly<{ ok: true; schedules: ReadonlyArray<WorkforceSchedule> }>
  | Readonly<{ ok: false; cause: unknown }>

export interface WorkforceSnapshotReadPort {
  readAllSnapshot(): Promise<WorkforceSnapshotReadResult>
}

export type OrganizationChangeWriteResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{ ok: false; kind: "conflict"; actualRevision: number }>
  | Readonly<{ ok: false; kind: "unavailable"; cause: unknown }>

export interface OrganizationChangeWritePort {
  append(change: OrganizationChangeSet): Promise<OrganizationChangeWriteResult>
}

export type OrganizationChangeValidationCode =
  | "empty_change"
  | "invalid_revision"
  | "invalid_operation"
  | "invalid_identity"
  | "unknown_employee"
  | "invalid_organization"
  | "invalid_workforce"

export class OrganizationChangeValidationError extends Error {
  constructor(readonly code: OrganizationChangeValidationCode) {
    super(code)
    this.name = "OrganizationChangeValidationError"
  }
}

export type ApplyOrganizationChangeResult =
  | Readonly<{ kind: "applied"; revision: number }>
  | Readonly<{ kind: "conflict"; actualRevision: number }>
  | Readonly<{ kind: "invalid"; error: OrganizationChangeValidationError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export type ValidateOrganizationChangeResult =
  | Readonly<{ kind: "valid"; resultingRevision: number }>
  | Exclude<ApplyOrganizationChangeResult, Readonly<{ kind: "applied"; revision: number }>>

type VersionedPeriod = OrganizationUnitPeriod | OrgAssignmentPeriod | OrgResponsibilityPeriod

function sameOwner(left: VersionedPeriod, right: VersionedPeriod): boolean {
  if ("officialName" in left || "officialName" in right) {
    return (
      "officialName" in left &&
      "officialName" in right &&
      left.organizationUnitId === right.organizationUnitId
    )
  }
  if ("assignmentType" in left || "assignmentType" in right) {
    return (
      "assignmentType" in left &&
      "assignmentType" in right &&
      left.employmentId === right.employmentId &&
      left.employeeId === right.employeeId &&
      left.organizationUnitId === right.organizationUnitId &&
      left.assignmentType === right.assignmentType
    )
  }
  return (
    left.employmentId === right.employmentId &&
    left.employeeId === right.employeeId &&
    left.organizationUnitId === right.organizationUnitId &&
    left.responsibilityType === right.responsibilityType
  )
}

function replacePeriods<TPeriod extends VersionedPeriod>(
  current: ReadonlyArray<TPeriod>,
  additions: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> | OrganizationChangeValidationError {
  const latest = new Map(current.map((period) => [period.periodId, period]))
  for (const addition of additions) {
    const previous = latest.get(addition.periodId)
    if (
      addition.revision !== (previous?.revision ?? 0) + 1 ||
      (previous !== undefined && !sameOwner(previous, addition))
    ) {
      return new OrganizationChangeValidationError("invalid_revision")
    }
    latest.set(addition.periodId, addition)
  }
  return [...latest.values()]
}

function applyWorkforceChanges(
  schedules: ReadonlyArray<WorkforceSchedule>,
  change: OrganizationChangeSet,
): ReadonlyArray<WorkforceSchedule> | OrganizationChangeValidationError {
  const byEmployee = new Map(schedules.map((schedule) => [schedule.employee.id, schedule]))
  for (const period of [...change.assignments, ...change.responsibilities]) {
    if (!byEmployee.has(period.employeeId)) {
      return new OrganizationChangeValidationError("unknown_employee")
    }
  }

  return schedules
    .map((schedule) => {
      const assignments = replacePeriods(
        schedule.assignments,
        change.assignments.filter((period) => period.employeeId === schedule.employee.id),
      )
      if (assignments instanceof OrganizationChangeValidationError) return assignments
      const responsibilities = replacePeriods(
        schedule.responsibilities,
        change.responsibilities.filter((period) => period.employeeId === schedule.employee.id),
      )
      if (responsibilities instanceof OrganizationChangeValidationError) return responsibilities
      return { ...schedule, assignments, responsibilities }
    })
    .reduce<ReadonlyArray<WorkforceSchedule> | OrganizationChangeValidationError>(
      (result, schedule) => {
        if (result instanceof OrganizationChangeValidationError) return result
        return schedule instanceof OrganizationChangeValidationError
          ? schedule
          : [...result, schedule]
      },
      [],
    )
}

type OrganizationChangeReadPorts = Readonly<{
  organization: OrganizationUnitReadPort
  workforce: WorkforceSnapshotReadPort
}>

/** transaction composerからも使えるよう、Company組織変更をwrite前に共通検証する。 */
export class ValidateOrganizationChange {
  constructor(private readonly ports: OrganizationChangeReadPorts) {
    Object.freeze(this)
  }

  async execute(change: OrganizationChangeSet): Promise<ValidateOrganizationChangeResult> {
    const changes =
      change.unitPeriods.length + change.assignments.length + change.responsibilities.length
    if (changes === 0) {
      return { kind: "invalid", error: new OrganizationChangeValidationError("empty_change") }
    }
    if (
      !Number.isSafeInteger(change.expectedRevision) ||
      change.expectedRevision < 0 ||
      !Number.isSafeInteger(change.recordedAt) ||
      change.recordedAt < 0 ||
      [...change.unitPeriods, ...change.assignments, ...change.responsibilities].some(
        (period) =>
          period.recordedByActionId !== change.operationId ||
          period.recordedAt !== change.recordedAt,
      )
    ) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_operation"),
      }
    }

    let organization
    let workforce
    try {
      organization = await this.ports.organization.readSnapshot(change.asOf)
      workforce = await this.ports.workforce.readAllSnapshot()
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
    if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
    if (organization.snapshot.revision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: organization.snapshot.revision }
    }

    const currentUnitIds = new Set(
      organization.snapshot.units.map((period) => period.organizationUnitId),
    )
    const newUnitIds = new Set<OrganizationUnitId>()
    for (const identity of change.organizationUnits) {
      if (
        currentUnitIds.has(identity.id) ||
        newUnitIds.has(identity.id) ||
        !Number.isSafeInteger(identity.createdAt) ||
        identity.createdAt < 0
      ) {
        return {
          kind: "invalid",
          error: new OrganizationChangeValidationError("invalid_identity"),
        }
      }
      newUnitIds.add(identity.id)
    }
    if (
      change.unitPeriods.some(
        (period) =>
          !currentUnitIds.has(period.organizationUnitId) &&
          !newUnitIds.has(period.organizationUnitId),
      ) ||
      [...newUnitIds].some(
        (unitId) => !change.unitPeriods.some((period) => period.organizationUnitId === unitId),
      )
    ) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_identity"),
      }
    }

    const units = replacePeriods(organization.snapshot.units, change.unitPeriods)
    if (units instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: units }
    }
    const organizationError = validateOrganizationUnitSnapshot({
      revision: change.expectedRevision + changes,
      asOf: change.asOf,
      units,
    })
    if (organizationError !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_organization"),
      }
    }

    const schedules = applyWorkforceChanges(workforce.schedules, change)
    if (schedules instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: schedules }
    }
    if (validateWorkforceSchedules({ schedules, organizationUnitPeriods: units }) !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_workforce"),
      }
    }

    return { kind: "valid", resultingRevision: change.expectedRevision + changes }
  }
}

/** OrgUnit・所属・責務の変更全体を検証し、expected revision付きで原子的に追記する。 */
export class ApplyOrganizationChange {
  constructor(
    private readonly ports: OrganizationChangeReadPorts &
      Readonly<{ writer: OrganizationChangeWritePort }>,
  ) {
    Object.freeze(this)
  }

  async execute(change: OrganizationChangeSet): Promise<ApplyOrganizationChangeResult> {
    const validation = await new ValidateOrganizationChange(this.ports).execute(change)
    if (validation.kind !== "valid") return validation

    let written: OrganizationChangeWriteResult
    try {
      written = await this.ports.writer.append(change)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (written.ok) {
      return written.revision === validation.resultingRevision
        ? { kind: "applied", revision: written.revision }
        : {
            kind: "unavailable",
            cause: new Error("organization writer returned an unexpected revision"),
          }
    }
    return written.kind === "conflict"
      ? { kind: "conflict", actualRevision: written.actualRevision }
      : { kind: "unavailable", cause: written.cause }
  }
}
