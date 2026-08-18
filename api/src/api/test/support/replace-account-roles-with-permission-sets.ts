import type { Context } from "@/env"

export async function replaceAccountRolesWithPermissionSets(
  context: Context,
  accountId: number,
  roleKeyPrefix: string,
  permissionSets: ReadonlyArray<ReadonlyArray<string>>,
): Promise<ReadonlyArray<{ id: number; key: string }>> {
  const db = context.env.DB

  await db.prepare("DELETE FROM account_roles WHERE account_id = ?1").bind(accountId).run()
  await db
    .prepare("DELETE FROM system_role_bindings WHERE account_id = ?1")
    .bind(String(accountId))
    .run()

  const createdRoles: Array<{ id: number; key: string }> = []

  for (const [index, permissionKeys] of permissionSets.entries()) {
    const roleKey = `${roleKeyPrefix}-${index + 1}`
    const inserted = await db
      .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?1, 0, 0)")
      .bind(roleKey)
      .run()
    const roleId = inserted.meta.last_row_id
    await db
      .prepare(
        `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?3, 0, 0)`,
      )
      .bind(String(roleId), `company:${roleKey.toLowerCase()}`, roleKey)
      .run()

    for (const permissionKey of permissionKeys) {
      await db
        .prepare(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT ?1, id FROM permissions WHERE key = ?2`,
        )
        .bind(roleId, permissionKey)
        .run()
      await db
        .prepare(
          `INSERT INTO system_iam_role_permissions (role_id, permission_key)
           VALUES (?1, ?2)`,
        )
        .bind(String(roleId), permissionKey)
        .run()
    }

    await db
      .prepare(
        "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (?1, ?2, NULL, 0)",
      )
      .bind(accountId, roleId)
      .run()
    await db
      .prepare(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, NULL, NULL, 0, NULL)`,
      )
      .bind(`test:${accountId}:${roleId}`, String(accountId), String(roleId))
      .run()

    createdRoles.push({ id: roleId, key: roleKey })
  }

  return createdRoles
}
