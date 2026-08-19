import type { Context } from "@/env"
import type { AccountId } from "@system/domain/auth/account-id"

type RoleGuardInput = {
  actorAccountId: AccountId
  requiredPermissionKeys: ReadonlyArray<string>
  additionalProtectedPermissionKeys?: ReadonlyArray<string>
}

const LIVE_PERMISSION_GUARD_SENTINEL = "integer overflow"
const ABORT_EXPRESSION = "abs(-9223372036854775808)"

/**
 * D1 batch の同一スナップショット上で、active な実行者が操作権限を保持し、かつ対象ロール／
 * アカウントの現在権限と追加保護権限の全てを保持することを検証する live permission ガード。
 * 認証時点の session ではなく batch の DB snapshot で再認可し、違反時は batch 全体を rollback する。
 */
export class LivePermissionGuard {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * active な実行者が操作権限を保持し、かつ対象ロールの現在権限と追加保護権限の全てを
   * 保持することを検証する。role id で対象を特定する。
   */
  abortWhenActorCannotManageRoleById(
    input: RoleGuardInput & { targetRoleId: number },
  ): D1PreparedStatement {
    return this.rolePermissionGuard({
      ...input,
      targetColumn: "id",
      targetValue: String(input.targetRoleId),
    })
  }

  /** role key で対象を特定する live permission ガード。 */
  abortWhenActorCannotManageRoleByKey(
    input: RoleGuardInput & { targetRoleKey: string },
  ): D1PreparedStatement {
    return this.rolePermissionGuard({
      ...input,
      targetColumn: "key",
      targetValue: `company:${input.targetRoleKey}`,
    })
  }

  /**
   * active な実行者が操作権限を保持し、対象アカウントの現在の実効権限を全て保持することを
   * D1 batch 内で検証する。対象不在・実行者停止・退職・権限不足はいずれも fail closed とする。
   */
  abortWhenActorCannotManageAccount(input: {
    actorAccountId: AccountId
    targetAccountId: AccountId
    requiredPermissionKeys: ReadonlyArray<string>
  }): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `WITH actor_permissions AS (
           ${this.actorPermissionsSql()}
         ), target_permissions AS (
           SELECT DISTINCT permission.permission_key AS key
           FROM system_role_bindings assignment
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = assignment.role_id
           WHERE assignment.account_id = ?2
             AND assignment.resource_type IS NULL
             AND assignment.revoked_at IS NULL
         )
         SELECT CASE WHEN
           EXISTS (SELECT 1 FROM system_accounts WHERE id = ?2)
           AND ${this.actorHasAllJsonPermissionsSql("?3")}
           AND NOT EXISTS (
             SELECT 1 FROM target_permissions target_permission
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor_permission
               WHERE actor_permission.key = target_permission.key
             )
           )
         THEN 1 ELSE ${ABORT_EXPRESSION} END AS ok`,
    ).bind(
      String(input.actorAccountId),
      String(input.targetAccountId),
      JSON.stringify([...input.requiredPermissionKeys]),
    )
  }

  /** ガード文が発生させた「integer overflow」由来の意図的な abort かを判定する。 */
  static isAbortedBy(error: unknown): boolean {
    return error instanceof Error && error.message.includes(LIVE_PERMISSION_GUARD_SENTINEL)
  }

  private rolePermissionGuard(
    input: RoleGuardInput & { targetColumn: "id" | "key"; targetValue: number | string },
  ): D1PreparedStatement {
    const additionalProtectedPermissionKeys = input.additionalProtectedPermissionKeys ?? []

    return this.c.env.DB.prepare(
      `WITH actor_permissions AS (
           ${this.actorPermissionsSql()}
         ), target_permissions AS (
           SELECT DISTINCT permission.permission_key AS key
           FROM system_iam_roles target_role
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = target_role.id
           WHERE target_role.${input.targetColumn} = ?2
           UNION
           SELECT CAST(value AS TEXT) FROM json_each(?4)
         )
         SELECT CASE WHEN
           EXISTS (SELECT 1 FROM system_iam_roles target_role WHERE target_role.${input.targetColumn} = ?2)
           AND ${this.actorHasAllJsonPermissionsSql("?3")}
           AND NOT EXISTS (
             SELECT 1 FROM target_permissions target_permission
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor_permission
               WHERE actor_permission.key = target_permission.key
             )
           )
         THEN 1 ELSE ${ABORT_EXPRESSION} END AS ok`,
    ).bind(
      String(input.actorAccountId),
      input.targetValue,
      JSON.stringify([...input.requiredPermissionKeys]),
      JSON.stringify([...additionalProtectedPermissionKeys]),
    )
  }

  private actorPermissionsSql(): string {
    return `SELECT DISTINCT permission.permission_key AS key
            FROM system_accounts actor_account
            INNER JOIN account_employee_links actor_link
              ON actor_link.account_id = actor_account.id
            INNER JOIN employees actor_employee ON actor_employee.id = actor_link.employee_id
            INNER JOIN system_role_bindings assignment ON assignment.account_id = actor_account.id
            INNER JOIN system_iam_role_permissions permission ON permission.role_id = assignment.role_id
            WHERE actor_account.id = ?1
              AND actor_account.status = 'active'
              AND assignment.resource_type IS NULL
              AND assignment.revoked_at IS NULL
              AND actor_employee.status <> 'retired'`
  }

  private actorHasAllJsonPermissionsSql(jsonParameter: string): string {
    return `NOT EXISTS (
             SELECT 1 FROM json_each(${jsonParameter}) required_permission
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor_permission
               WHERE actor_permission.key = CAST(required_permission.value AS TEXT)
             )
           )`
  }
}
