import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"

export async function canDecideLegacyApplication(props: {
  c: Context
  session: Session
  applicantEmployeeId: number
  approverRoles: ReadonlyArray<string>
}): Promise<boolean | Error> {
  if (props.session.hasPermission("application:approve") === false) return false
  if (
    props.approverRoles.length > 0 &&
    props.session.roleKeys.some((roleKey) => props.approverRoles.includes(roleKey)) === false
  ) {
    return false
  }

  if (props.session.hasPermission("org:manage")) return true

  const authority = await resolveOrganizationAuthority(
    props.c,
    props.session.employeeId,
    props.applicantEmployeeId,
  )

  return authority instanceof Error
    ? authority
    : authority.managementChain || authority.departmentManager
}
