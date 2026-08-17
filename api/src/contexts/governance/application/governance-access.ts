import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { GovernanceMetadata } from "@/contexts/governance/domain/governance-document"
import type { Context } from "@/env"
import { loadCurrentOrganization } from "@/contexts/company-compatibility/application/organization/current-organization-read-model"
import { resolveGovernanceOrgRole } from "@/contexts/governance/application/resolve-governance-org-role"

type Props = {
  c: Context
  session: Session
}

/**
 * 規程（ガバナンス文書）に対するセッションの閲覧・審査・公開権限を判定する。
 * 権限キー判定と、適用対象（audience）・下書き閲覧可否の組織関係判定をまとめる。
 */
export class GovernanceAccess {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  canManage(): boolean {
    return this.props.session.permissions.has("governance:manage")
  }

  canRead(): boolean {
    return this.props.session.permissions.has("governance:read")
  }

  canReadRestricted(): boolean {
    return this.props.session.permissions.has("governance:read:restricted")
  }

  canReview(): boolean {
    return this.props.session.permissions.has("governance:review")
  }

  canPublish(): boolean {
    return this.props.session.permissions.has("governance:publish")
  }

  /** セッションが規程の適用対象（audience）に含まれるか判定する。 */
  async isAudienceMember(metadata: GovernanceMetadata): Promise<boolean | Error> {
    const session = this.props.session
    if (session.employeeStatus !== "active" && session.employeeStatus !== "leave") {
      return false
    }
    if (!metadata.audience.employee_statuses.includes(session.employeeStatus)) return false
    if (metadata.audience.all_employees) return true

    const organization = await loadCurrentOrganization(this.props.c)
    if (organization instanceof Error) return organization
    const employee = [...organization.employeesByCode.values()].find(
      (candidate) => candidate.id === session.employeeId,
    )
    if (
      employee !== undefined &&
      employee.departmentCodes.some((code) => metadata.audience.department_codes.includes(code))
    ) {
      return true
    }

    const roleResults = await Promise.all(
      metadata.audience.org_roles.map((code) =>
        resolveGovernanceOrgRole({ c: this.props.c, code }),
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
    const session = this.props.session
    if (props.isDraft) {
      if (this.canManage() || this.canPublish()) return true
      if (!this.canReview()) return false
      const roleResults = await Promise.all(
        props.metadata.publication.approver_org_roles.map((code) =>
          resolveGovernanceOrgRole({ c: this.props.c, code }),
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
