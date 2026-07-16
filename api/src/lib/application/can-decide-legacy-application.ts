import type { Context, SessionPayload } from "@/env"
import { canDecideApplication } from "@/lib/application/can-decide-application"
import { hasPermission } from "@/lib/auth/has-permission"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"

export async function canDecideLegacyApplication(props: {
  c: Context
  session: SessionPayload
  applicantEmployeeId: number
  approverRoles: ReadonlyArray<string>
}): Promise<boolean | Error> {
  if (canDecideApplication(props.session) === false) return false
  if (
    props.approverRoles.length > 0 &&
    props.session.roleKeys.some((roleKey) => props.approverRoles.includes(roleKey)) === false
  ) {
    return false
  }

  if (hasPermission(props.session, "org:manage")) return true

  const authority = await resolveOrganizationAuthority(
    props.c,
    props.session.employeeId,
    props.applicantEmployeeId,
  )

  return authority instanceof Error
    ? authority
    : authority.managementChain || authority.departmentManager
}
