import type { Context } from "@/env"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration.repository"

export async function findUnknownApproverRoles(
  c: Context,
  roleKeys: ReadonlyArray<string>,
): Promise<ReadonlyArray<string> | Error> {
  const uniqueRoleKeys = [...new Set(roleKeys)]
  if (uniqueRoleKeys.length === 0) return []

  const roles = await new SystemRoleAdministrationRepository({ env: { DB: c.env.DB } }).list()
  if (roles instanceof Error) return roles
  const existingKeys = new Set(roles.map((role) => role.key.replace(/^company:/u, "")))

  return uniqueRoleKeys.filter((roleKey) => existingKeys.has(roleKey) === false)
}
