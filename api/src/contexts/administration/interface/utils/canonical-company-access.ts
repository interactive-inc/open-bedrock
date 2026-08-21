import { ResolveOrganizationAuthority } from "@/contexts/company/infrastructure/workforce/resolve-organization-authority.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import type { Session } from "@/lib/auth/session"
import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/values/workforce-id.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/values/restore-org-responsibility-type.definition"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import type { Context } from "@/env"

export type CanonicalCompanyAuthorizationResult =
  | Readonly<{ kind: "authorized"; organizationRevision: number | null }>
  | Readonly<{ kind: "denied"; organizationRevision: number | null }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Props = Readonly<{ c: Context; session: Session }>

/** Technical Permissionとは別に、固定済みCompany組織上の対象範囲を評価する。 */
export class CanonicalCompanyAccess {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async authorizeWorkforceRead(
    employeeId: EmployeeId,
    asOf: CalendarDate,
  ): Promise<CanonicalCompanyAuthorizationResult> {
    if (employeeId === toWorkforceEmployeeId(this.props.session.employeeId)) {
      return { kind: "authorized", organizationRevision: null }
    }
    if (this.props.session.hasPermission("employee:lifecycle:read:all")) {
      return { kind: "authorized", organizationRevision: null }
    }

    return this.resolve({
      employeeId,
      asOf,
      criteria: [
        { kind: "direct_manager" },
        { kind: "subject_organization_manager" },
        { kind: "management_chain" },
      ],
    })
  }

  async authorizeOrganizationChange(
    asOf: CalendarDate,
  ): Promise<CanonicalCompanyAuthorizationResult> {
    return this.resolve({
      employeeId: null,
      asOf,
      criteria: [
        {
          kind: "responsibility",
          responsibilityType: restoreOrgResponsibilityType("PEOPLE_OPERATIONS"),
          organizationUnitId: null,
        },
      ],
    })
  }

  private async resolve(props: {
    employeeId: EmployeeId | null
    asOf: CalendarDate
    criteria: Parameters<ResolveOrganizationAuthority["execute"]>[0]["criteria"]
  }): Promise<CanonicalCompanyAuthorizationResult> {
    const result = await new ResolveOrganizationAuthority({
      organization: new OrganizationUnitReadRepository(this.props.c.var.database),
      workforce: new OrganizationWorkforceSnapshotRepository(this.props.c),
    }).execute({
      subjectEmployeeId: props.employeeId,
      criteria: props.criteria,
      asOf: props.asOf,
    })
    if (result.kind === "unavailable") return { kind: "unavailable", cause: result.cause }
    if (result.kind === "invalid") return { kind: "invalid" }

    const organizationRevision = result.resolution.snapshot.organizationRevision
    const isAuthorized = result.resolution.candidates.some(
      (candidate) => String(candidate.accountId) === String(this.props.session.accountId),
    )

    return {
      kind: isAuthorized ? "authorized" : "denied",
      organizationRevision,
    }
  }
}
