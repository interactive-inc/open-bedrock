import type { WorkforceSnapshotReadPort } from "@/contexts/company/domain/workforce/organization-change"
import type { OrganizationUnitReadPort } from "@/contexts/company/infrastructure/workforce/read-organization-state.repository"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/workforce/workforce-snapshot-changed-error"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/organization-unit"
import {
  resolveWorkforceStateAt,
  type WorkforceStateAt,
} from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { WorkforceStateResolutionError } from "@/contexts/company/domain/workforce/workforce-state-resolution-error"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/workforce/workforce-invariant"
import { validateWorkforceSchedules } from "@/contexts/company/domain/workforce/validate-workforce-schedules"

export type ReadOrganizationWorkforceStateResult =
  | Readonly<{
      kind: "found"
      organization: OrganizationUnitSnapshot
      employees: ReadonlyArray<WorkforceStateAt>
    }>
  | Readonly<{
      kind: "invalid"
      error:
        | OrganizationInvariantViolation
        | WorkforceInvariantViolation
        | WorkforceStateResolutionError
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Props = Readonly<{
  organization: OrganizationUnitReadPort
  workforce: WorkforceSnapshotReadPort
}>

/** 同一revisionのOrgUnit、Assignment、Responsibilityを一つの時点snapshotとして読む。 */
export class ReadOrganizationWorkforceState {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(asOf: CalendarDate): Promise<ReadOrganizationWorkforceStateResult> {
    try {
      const organization = await this.props.organization.readSnapshot(asOf)
      if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
      const organizationError = validateOrganizationUnitSnapshot(organization.snapshot)
      if (organizationError !== null) return { kind: "invalid", error: organizationError }

      const workforce = await this.props.workforce.readAllSnapshot()
      if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
      const workforceError = validateWorkforceSchedules({
        schedules: workforce.schedules,
        organizationUnitPeriods: organization.snapshot.units,
      })
      if (workforceError !== null) return { kind: "invalid", error: workforceError }

      const employees: WorkforceStateAt[] = []
      for (const schedule of workforce.schedules) {
        const employee = resolveWorkforceStateAt(
          {
            employeeId: schedule.employee.id,
            baselineState: schedule.baselineState,
            employments: schedule.employments,
            statuses: schedule.statuses,
            assignments: schedule.assignments,
            responsibilities: schedule.responsibilities,
          },
          asOf,
        )
        if (employee instanceof Error) return { kind: "invalid", error: employee }
        employees.push(employee)
      }

      const revision = await this.props.organization.readRevision()
      if (!revision.ok) return { kind: "unavailable", cause: revision.cause }
      if (revision.revision !== organization.snapshot.revision) {
        return { kind: "unavailable", cause: new WorkforceSnapshotChangedError() }
      }

      return { kind: "found", organization: organization.snapshot, employees }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
