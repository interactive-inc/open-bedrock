const LIVE_PERMISSION_GUARD_SENTINEL = "integer overflow"
const ABORT_EXPRESSION = "abs(-9223372036854775808)"

export class LivePermissionGuardError extends Error {
  constructor(options?: ErrorOptions) {
    super("live permission boundary rejected the operation", options)
    this.name = "LivePermissionGuardError"
  }
}

type RoleGuardProps = {
  db: D1Database
  actorAccountId: number
  requiredPermissionKeys: ReadonlyArray<string>
  additionalProtectedPermissionKeys?: ReadonlyArray<string>
}

/**
 * D1 batch の同一スナップショット上で、active な実行者が操作権限を保持し、かつ対象ロールの
 * 現在権限と追加保護権限の全てを保持することを検証する。違反時は batch 全体を rollback する。
 */
export function abortWhenActorCannotManageRoleById(
  props: RoleGuardProps & { targetRoleId: number },
): D1PreparedStatement {
  return rolePermissionGuard({
    ...props,
    targetColumn: "id",
    targetValue: props.targetRoleId,
  })
}

/** role key で対象を特定する AccountProvisioner 用の live permission ガード。 */
export function abortWhenActorCannotManageRoleByKey(
  props: RoleGuardProps & { targetRoleKey: string },
): D1PreparedStatement {
  return rolePermissionGuard({
    ...props,
    targetColumn: "key",
    targetValue: props.targetRoleKey,
  })
}

/**
 * active な実行者が操作権限を保持し、対象アカウントの現在の実効権限を全て保持することを
 * D1 batch 内で検証する。対象不在・実行者停止・退職・権限不足はいずれも fail closed とする。
 */
export function abortWhenActorCannotManageAccount(props: {
  db: D1Database
  actorAccountId: number
  targetAccountId: number
  requiredPermissionKeys: ReadonlyArray<string>
}): D1PreparedStatement {
  return props.db
    .prepare(
      `WITH actor_permissions AS (
         ${actorPermissionsSql()}
       ), target_permissions AS (
         SELECT DISTINCT permission.key
         FROM account_roles assignment
         INNER JOIN role_permissions role_permission ON role_permission.role_id = assignment.role_id
         INNER JOIN permissions permission ON permission.id = role_permission.permission_id
         WHERE assignment.account_id = ?2
       )
       SELECT CASE WHEN
         EXISTS (SELECT 1 FROM accounts WHERE id = ?2)
         AND ${actorHasAllJsonPermissionsSql("?3")}
         AND NOT EXISTS (
           SELECT 1 FROM target_permissions target_permission
           WHERE NOT EXISTS (
             SELECT 1 FROM actor_permissions actor_permission
             WHERE actor_permission.key = target_permission.key
           )
         )
       THEN 1 ELSE ${ABORT_EXPRESSION} END AS ok`,
    )
    .bind(
      props.actorAccountId,
      props.targetAccountId,
      JSON.stringify([...props.requiredPermissionKeys]),
    )
}

export function isAbortedByLivePermissionGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes(LIVE_PERMISSION_GUARD_SENTINEL)
}

function rolePermissionGuard(
  props: RoleGuardProps & { targetColumn: "id" | "key"; targetValue: number | string },
): D1PreparedStatement {
  const additionalProtectedPermissionKeys = props.additionalProtectedPermissionKeys ?? []

  return props.db
    .prepare(
      `WITH actor_permissions AS (
         ${actorPermissionsSql()}
       ), target_permissions AS (
         SELECT DISTINCT permission.key
         FROM roles target_role
         INNER JOIN role_permissions role_permission ON role_permission.role_id = target_role.id
         INNER JOIN permissions permission ON permission.id = role_permission.permission_id
         WHERE target_role.${props.targetColumn} = ?2
         UNION
         SELECT CAST(value AS TEXT) FROM json_each(?4)
       )
       SELECT CASE WHEN
         EXISTS (SELECT 1 FROM roles target_role WHERE target_role.${props.targetColumn} = ?2)
         AND ${actorHasAllJsonPermissionsSql("?3")}
         AND NOT EXISTS (
           SELECT 1 FROM target_permissions target_permission
           WHERE NOT EXISTS (
             SELECT 1 FROM actor_permissions actor_permission
             WHERE actor_permission.key = target_permission.key
           )
         )
       THEN 1 ELSE ${ABORT_EXPRESSION} END AS ok`,
    )
    .bind(
      props.actorAccountId,
      props.targetValue,
      JSON.stringify([...props.requiredPermissionKeys]),
      JSON.stringify([...additionalProtectedPermissionKeys]),
    )
}

function actorPermissionsSql(): string {
  return `SELECT DISTINCT permission.key
          FROM accounts actor_account
          INNER JOIN employees actor_employee ON actor_employee.id = actor_account.employee_id
          INNER JOIN account_roles assignment ON assignment.account_id = actor_account.id
          INNER JOIN role_permissions role_permission ON role_permission.role_id = assignment.role_id
          INNER JOIN permissions permission ON permission.id = role_permission.permission_id
          WHERE actor_account.id = ?1
            AND actor_account.status = 'active'
            AND actor_employee.status <> 'retired'`
}

function actorHasAllJsonPermissionsSql(jsonParameter: string): string {
  return `NOT EXISTS (
           SELECT 1 FROM json_each(${jsonParameter}) required_permission
           WHERE NOT EXISTS (
             SELECT 1 FROM actor_permissions actor_permission
             WHERE actor_permission.key = CAST(required_permission.value AS TEXT)
           )
         )`
}
