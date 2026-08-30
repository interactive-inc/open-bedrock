import { ResolveOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organization-authority.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Context } from "@/env"

export type CanReadExpenseInput = Readonly<{
  session: CompanySessionValue
  applicantEmployeeId: EmployeeId
}>

/**
 * 経費を閲覧してよいかを判定する。本人、全社閲覧権限、または承認権限と組織スコープを持つ上長。
 * 添付のダウンロードもこの判定を継承し、親の経費を見られない人には添付も見せない。
 */
export class CanReadExpenseAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async canReadExpense(input: CanReadExpenseInput): Promise<boolean | Error> {
    if (input.applicantEmployeeId === input.session.employeeId) return true

    if (input.session.hasPermission("expense:read:all")) return true

    if (!input.session.hasPermission("expense:approve")) return false

    if (input.session.hasPermission("org:manage")) return true

    const organizationAuthority = await new ResolveOrganizationAuthorityAdapter(
      this.c,
    ).resolveOrganizationAuthority(input.session.employeeId, input.applicantEmployeeId)

    if (organizationAuthority instanceof Error) return organizationAuthority

    return organizationAuthority.managementChain || organizationAuthority.departmentManager
  }
}
