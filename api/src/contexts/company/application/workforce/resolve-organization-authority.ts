import type { WorkforceSnapshotReadPort } from "@/contexts/company/application/workforce/organization-change"
import type { OrganizationUnitReadPort } from "@/contexts/company/application/workforce/read-organization-state"
import { WorkforceSnapshotChangedError } from "@/contexts/company/application/workforce/workforce-snapshot-changed-error"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityResolution,
} from "@/contexts/company/domain/workforce/organizational-authority"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import { resolveOrganizationalAuthority } from "@/contexts/company/domain/workforce/resolve-organizational-authority"
import {
  resolveWorkforceStateAt,
  type WorkforceStateAt,
} from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { WorkforceStateResolutionError } from "@/contexts/company/domain/workforce/workforce-state-resolution-error"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import { validateWorkforceSchedules } from "@/contexts/company/domain/workforce/validate-workforce-schedules"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export type ResolveOrganizationAuthorityResult =
  | Readonly<{ kind: "resolved"; resolution: OrganizationalAuthorityResolution }>
  | Readonly<{
      kind: "invalid"
      error:
        | OrganizationInvariantViolation
        | WorkforceInvariantViolation
        | WorkforceStateResolutionError
        | OrganizationalAuthorityError
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** 同一organization revisionの全Workforce stateからCompany組織資格を解決する。 */
export class ResolveOrganizationAuthority {
  constructor(
    private readonly ports: Readonly<{
      organization: OrganizationUnitReadPort
      workforce: WorkforceSnapshotReadPort
    }>,
  ) {
    Object.freeze(this)
  }

  async execute(
    props: Readonly<{
      subjectEmployeeId: EmployeeId | null
      criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
      asOf: CalendarDate
    }>,
  ): Promise<ResolveOrganizationAuthorityResult> {
    try {
      const organization = await this.ports.organization.readSnapshot(props.asOf)
      if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
      const organizationError = validateOrganizationUnitSnapshot(organization.snapshot)
      if (organizationError !== null) return { kind: "invalid", error: organizationError }

      const workforce = await this.ports.workforce.readAllSnapshot()
      if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
      const currentRevision = await this.ports.organization.readRevision()
      if (!currentRevision.ok) return { kind: "unavailable", cause: currentRevision.cause }
      if (currentRevision.revision !== organization.snapshot.revision) {
        return { kind: "unavailable", cause: new WorkforceSnapshotChangedError() }
      }

      const workforceError = validateWorkforceSchedules({
        schedules: workforce.schedules,
        organizationUnitPeriods: organization.snapshot.units,
      })
      if (workforceError !== null) return { kind: "invalid", error: workforceError }

      const states: WorkforceStateAt[] = []
      for (const schedule of workforce.schedules) {
        const state = resolveWorkforceStateAt(
          {
            employeeId: schedule.employee.id,
            baselineState: schedule.baselineState,
            employments: schedule.employments,
            statuses: schedule.statuses,
            assignments: schedule.assignments,
            responsibilities: schedule.responsibilities,
          },
          props.asOf,
        )
        if (state instanceof Error) return { kind: "invalid", error: state }
        states.push(state)
      }

      const resolution = resolveOrganizationalAuthority({
        snapshot: {
          schemaVersion: 1,
          source: "lifecycle",
          asOf: props.asOf,
          organizationRevision: organization.snapshot.revision,
        },
        subjectEmployeeId: props.subjectEmployeeId,
        criteria: props.criteria,
        states,
        accountLinks: workforce.schedules.flatMap((schedule) =>
          schedule.accountLink === null ? [] : [schedule.accountLink],
        ),
      })
      return resolution instanceof OrganizationalAuthorityError
        ? { kind: "invalid", error: resolution }
        : { kind: "resolved", resolution }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
