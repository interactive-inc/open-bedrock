import type { Context } from "@/env"
import { roles } from "@/schema"
import { inArray } from "drizzle-orm"

export async function findUnknownApproverRoles(
  c: Context,
  roleKeys: ReadonlyArray<string>,
): Promise<ReadonlyArray<string> | Error> {
  const uniqueRoleKeys = [...new Set(roleKeys)]
  if (uniqueRoleKeys.length === 0) return []

  try {
    const existing = await c.var.database
      .select({ key: roles.key })
      .from(roles)
      .where(inArray(roles.key, uniqueRoleKeys))
    const existingKeys = new Set(existing.map((role) => role.key))

    return uniqueRoleKeys.filter((roleKey) => existingKeys.has(roleKey) === false)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to validate approver roles")
  }
}
