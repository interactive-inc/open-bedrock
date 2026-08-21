import { resolveOrganizationAuthority } from "@/contexts/company/infrastructure/organization/resolve-organization-authority.repository"
import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"

export type CanReadExpenseInput = Readonly<{
  session: Session
  applicantEmployeeId: number
}>

/**
 * 経費を閲覧してよいかを判定する。本人、全社閲覧権限、または承認権限と組織スコープを持つ上長。
 * 添付のダウンロードもこの判定を継承し、親の経費を見られない人には添付も見せない。
 */
export async function canReadExpense(
  c: Context,
  input: CanReadExpenseInput,
): Promise<boolean | Error> {
  if (input.applicantEmployeeId === input.session.employeeId) return true

  if (input.session.hasPermission("expense:read:all")) return true

  if (!input.session.hasPermission("expense:approve")) return false

  if (input.session.hasPermission("org:manage")) return true

  const organizationAuthority = await resolveOrganizationAuthority(
    c,
    input.session.employeeId,
    input.applicantEmployeeId,
  )

  if (organizationAuthority instanceof Error) return organizationAuthority

  return organizationAuthority.managementChain || organizationAuthority.departmentManager
}
