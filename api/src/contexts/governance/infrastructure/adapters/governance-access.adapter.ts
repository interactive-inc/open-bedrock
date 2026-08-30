import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { GovernanceMetadata } from "@/contexts/governance/domain/definitions/governance-document.definition"
import type { Context as HonoContext } from "@/env"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { ResolveGovernanceOrgRoleAdapter } from "@/contexts/governance/infrastructure/adapters/resolve-governance-org-role.adapter"

type Context = {
  context: HonoContext
  session: CompanySessionValue
}

/**
 * 規程（ガバナンス文書）に対するセッションの閲覧・審査・公開権限を判定する。
 * 権限キー判定と、適用対象（audience）・下書き閲覧可否の組織関係判定をまとめる。
 */
export class GovernanceAccessAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  canManage(): boolean {
    return this.c.session.permissions.has("governance:manage")
  }

  canRead(): boolean {
    return this.c.session.permissions.has("governance:read")
  }

  canReadRestricted(): boolean {
    return this.c.session.permissions.has("governance:read:restricted")
  }

  canReview(): boolean {
    return this.c.session.permissions.has("governance:review")
  }

  canPublish(): boolean {
    return this.c.session.permissions.has("governance:publish")
  }

  /** セッションが規程の適用対象（audience）に含まれるか判定する。 */
  async isAudienceMember(metadata: GovernanceMetadata): Promise<boolean | Error> {
    const session = this.c.session
    if (session.employmentStatus !== "ACTIVE" && session.employmentStatus !== "ON_LEAVE") {
      return false
    }
    if (!metadata.audience.employment_statuses.includes(session.employmentStatus)) return false
    if (metadata.audience.all_employees) return true

    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      this.c.context,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) return snapshot
    const employee = snapshot.employees.find(
      (candidate) => candidate.employeeId === session.employeeId,
    )
    const codeByUnitId = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit.code] as const),
    )
    const departmentCodes =
      employee === undefined
        ? []
        : [
            ...(employee.primaryAssignment === null ? [] : [employee.primaryAssignment]),
            ...employee.concurrentAssignments,
          ].flatMap((assignment) => {
            const code = codeByUnitId.get(assignment.organizationUnitId)
            return code === undefined ? [] : [code]
          })
    if (departmentCodes.some((code) => metadata.audience.department_codes.includes(code))) {
      return true
    }

    const roleResults = await Promise.all(
      metadata.audience.org_roles.map((code) =>
        new ResolveGovernanceOrgRoleAdapter(this.c.context).resolveGovernanceOrgRole(code),
      ),
    )
    const error = roleResults.find((result) => result instanceof Error)
    if (error instanceof Error) return error
    return roleResults.some(
      (result) =>
        !(result instanceof Error) &&
        result.some((assignee) => assignee.employee_id === session.employeeId),
    )
  }

  /** 規程ドキュメント（版）の閲覧可否を判定する。下書きは審査担当・管理者のみ。 */
  async canReadDocument(props: {
    metadata: GovernanceMetadata
    isDraft: boolean
  }): Promise<boolean | Error> {
    const session = this.c.session
    if (props.isDraft) {
      if (this.canManage() || this.canPublish()) return true
      if (!this.canReview()) return false
      const roleResults = await Promise.all(
        props.metadata.publication.approver_org_roles.map((code) =>
          new ResolveGovernanceOrgRoleAdapter(this.c.context).resolveGovernanceOrgRole(code),
        ),
      )
      const error = roleResults.find((result) => result instanceof Error)
      if (error instanceof Error) return error
      return roleResults.some(
        (result) =>
          !(result instanceof Error) &&
          result.some((assignee) => assignee.employee_id === session.employeeId),
      )
    }
    if (!this.canRead()) return false
    if (
      props.metadata.classification === "public" ||
      props.metadata.classification === "internal" ||
      this.canReadRestricted()
    ) {
      return true
    }
    return await this.isAudienceMember(props.metadata)
  }
}
