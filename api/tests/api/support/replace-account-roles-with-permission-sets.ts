import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

export async function replaceAccountRolesWithPermissionSets(
  context: Context,
  accountId: AccountId,
  roleKeyPrefix: string,
  permissionSets: ReadonlyArray<ReadonlyArray<string>>,
): Promise<ReadonlyArray<{ id: string; key: string }>> {
  const db = context.env.DB

  await db
    .prepare("DELETE FROM system_role_bindings WHERE account_id = ?1")
    .bind(String(accountId))
    .run()

  const createdRoles: Array<{ id: string; key: string }> = []

  for (const [index, permissionKeys] of permissionSets.entries()) {
    const roleKey = `${roleKeyPrefix}-${index + 1}`
    const roleId = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?3, 0, 0)`,
      )
      .bind(roleId, `company:${roleKey.toLowerCase()}`, roleKey)
      .run()

    for (const permissionKey of permissionKeys) {
      await db
        .prepare(
          `INSERT INTO system_iam_role_permissions (role_id, permission_key)
           VALUES (?1, ?2)`,
        )
        .bind(roleId, permissionKey)
        .run()
    }

    await db
      .prepare(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, NULL, NULL, 0, NULL)`,
      )
      .bind(crypto.randomUUID(), String(accountId), roleId)
      .run()

    createdRoles.push({ id: roleId, key: roleKey })
  }

  return createdRoles
}
