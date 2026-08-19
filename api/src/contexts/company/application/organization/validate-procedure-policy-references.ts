import type { Context } from "@/env"

export async function findUnknownApproverRoles(
  c: Context,
  roleKeys: ReadonlyArray<string>,
): Promise<ReadonlyArray<string> | Error> {
  const uniqueRoleKeys = [...new Set(roleKeys)]
  if (uniqueRoleKeys.length === 0) return []

  try {
    const existing = await c.env.DB.prepare(
      `SELECT key FROM system_iam_roles
         WHERE key IN (
           SELECT 'company:' || CAST(value AS TEXT) FROM json_each(?1)
         )`,
    )
      .bind(JSON.stringify(uniqueRoleKeys))
      .all<{ key: string }>()
    const existingKeys = new Set(existing.results.map((role) => role.key.replace(/^company:/, "")))

    return uniqueRoleKeys.filter((roleKey) => existingKeys.has(roleKey) === false)
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to validate approver roles")
  }
}
