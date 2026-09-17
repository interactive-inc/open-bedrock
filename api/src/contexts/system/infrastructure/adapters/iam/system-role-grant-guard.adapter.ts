import { sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { drizzle } from "drizzle-orm/d1"

/** 条件が変われば必ず一行の SELECT が失敗し、後続の role binding を含む batch を戻す。 */
export function prepareSystemRoleGrantGuardStatement(
  input: Readonly<{
    database: D1Database
    accountId: string
    roleId: string
    resourceType: string
    forbiddenPermissionKeys: ReadonlyArray<string>
  }>,
): BatchItem<"sqlite"> {
  return drizzle(input.database)
    .select({
      grantGuard: sql<number>`json_extract(CASE WHEN
        EXISTS (SELECT 1 FROM system_accounts account
          WHERE account.id = ${input.accountId} AND account.status = 'active'
            AND account.closed_at IS NULL)
        AND EXISTS (SELECT 1 FROM system_iam_roles role
          WHERE role.id = ${input.roleId} AND role.resource_type = ${input.resourceType})
        AND NOT EXISTS (SELECT 1 FROM system_iam_role_permissions permission
          WHERE permission.role_id = ${input.roleId}
            AND permission.permission_key IN
              (SELECT value FROM json_each(${JSON.stringify(input.forbiddenPermissionKeys)})))
        THEN '{"ok":1}' ELSE 'system_role_grant_conflict'
      END, '$.ok')`,
    })
    .from(sql`(SELECT 1) AS system_role_grant_guard`)
}
