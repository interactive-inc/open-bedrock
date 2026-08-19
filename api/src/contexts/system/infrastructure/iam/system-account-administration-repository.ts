import type { AccountId } from "@system/domain/auth/account-id"
import { zAccountId } from "@system/domain/auth/account-id"
import type { AccountStatus } from "@system/domain/auth/account-status"
import { Account } from "@system/domain/auth/account.entity"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

type AccountRow = Readonly<{
  id: string
  status: unknown
  token_version: unknown
  created_at: unknown
  updated_at: unknown
}>

type RoleKeyRow = Readonly<{
  account_id: string
  role_key: string
}>

export type SystemAccountAdministrationView = Readonly<{
  id: AccountId
  status: AccountStatus
  tokenVersion: number
  roleKeys: ReadonlyArray<string>
  createdAt: Date
  updatedAt: Date
}>

export type SystemAccountStatusUpdate =
  | "updated"
  | "unchanged"
  | "not_found"
  | "forbidden"
  | "last_root"

/** Account一覧と、失効を伴うstatus変更をCompanyなしで保存する。 */
export class SystemAccountAdministrationRepository {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async list(): Promise<ReadonlyArray<SystemAccountAdministrationView> | Error> {
    try {
      const accounts = await this.context.env.DB.prepare(
        `SELECT id, status, token_version, created_at, updated_at
         FROM system_accounts
         WHERE id <> 'system:migration'
         ORDER BY id`,
      ).all<AccountRow>()
      const roleKeys = await this.context.env.DB.prepare(
        `SELECT binding.account_id, role.key AS role_key
         FROM system_role_bindings binding
         INNER JOIN system_iam_roles role ON role.id = binding.role_id
         WHERE binding.revoked_at IS NULL
         ORDER BY binding.account_id, role.key`,
      ).all<RoleKeyRow>()
      if (!accounts.success || !roleKeys.success) {
        return new Error("failed to list System Accounts")
      }

      const views: Array<SystemAccountAdministrationView> = []
      for (const row of accounts.results) {
        const view = this.toView(row, roleKeys.results)
        if (view instanceof Error) return view

        views.push(view)
      }

      return Object.freeze(views)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Accounts")
    }
  }

  async findById(accountId: AccountId): Promise<SystemAccountAdministrationView | null | Error> {
    try {
      const row = await this.context.env.DB.prepare(
        `SELECT id, status, token_version, created_at, updated_at
         FROM system_accounts
         WHERE id = ?1 AND id <> 'system:migration'
         LIMIT 1`,
      )
        .bind(accountId)
        .first<AccountRow>()
      if (row === null) return null

      const roleKeys = await this.context.env.DB.prepare(
        `SELECT binding.account_id, role.key AS role_key
         FROM system_role_bindings binding
         INNER JOIN system_iam_roles role ON role.id = binding.role_id
         WHERE binding.account_id = ?1 AND binding.revoked_at IS NULL
         ORDER BY role.key`,
      )
        .bind(accountId)
        .all<RoleKeyRow>()
      if (!roleKeys.success) return new Error("failed to read System Account roles")

      return this.toView(row, roleKeys.results)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System Account")
    }
  }

  async create(
    accountId: AccountId,
    now: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | "conflict" | Error> {
    try {
      const statements = [
        this.context.env.DB.prepare(
          `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
           VALUES (?1, 'active', 0, ?2, ?2)`,
        ).bind(accountId, now.getTime()),
        ...auditStatements,
      ]
      const executions = await this.context.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System Account creation batch did not succeed")
      }

      return "created"
    } catch (caught) {
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique")) {
        return "conflict"
      }

      return caught instanceof Error ? caught : new Error("failed to create System Account")
    }
  }

  async setStatus(
    actorAccountId: AccountId,
    targetAccountId: AccountId,
    status: AccountStatus,
    now: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemAccountStatusUpdate | Error> {
    const target = await this.findById(targetAccountId)
    if (target === null) return "not_found"
    if (target instanceof Error) return target
    if (actorAccountId === targetAccountId && status !== "active") return "forbidden"

    const account = Account.create({
      id: target.id,
      status: target.status,
      tokenVersion: target.tokenVersion,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    })
    if (account instanceof Error) return account
    const changed =
      status === "active"
        ? account.activate(now)
        : status === "suspended"
          ? account.suspend(now)
          : account.lock(now)
    if (changed instanceof Error) return changed
    if (changed.tokenVersion === account.tokenVersion) return "unchanged"

    try {
      const statements = [
        this.prepareActorAccountGuard(actorAccountId, targetAccountId),
        this.context.env.DB.prepare(
          `UPDATE system_accounts
           SET status = ?2,
               token_version = ?3,
               updated_at = ?4
           WHERE id = ?1
             AND status = ?5
             AND token_version = ?6
             AND updated_at = ?7`,
        ).bind(
          targetAccountId,
          changed.status,
          changed.tokenVersion,
          changed.updatedAt.getTime(),
          account.status,
          account.tokenVersion,
          account.updatedAt.getTime(),
        ),
        this.context.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        this.prepareLastRootGuard(),
        ...auditStatements,
      ]
      const executions = await this.context.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System Account status batch did not succeed")
      }

      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        return "last_root"
      }

      return caught instanceof Error ? caught : new Error("failed to update System Account")
    }
  }

  private prepareActorAccountGuard(
    actorAccountId: AccountId,
    targetAccountId: AccountId,
  ): D1PreparedStatement {
    return this.context.env.DB.prepare(
      `WITH actor_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_accounts account
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.id = ?1
           AND account.status = 'active'
           AND binding.resource_type IS NULL
           AND binding.revoked_at IS NULL
       ), target_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_role_bindings binding
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE binding.account_id = ?2
           AND binding.revoked_at IS NULL
       )
       SELECT CASE WHEN
         EXISTS (
           SELECT 1 FROM actor_permissions
           WHERE key IN ('system:admin', 'iam:write')
         )
         AND (
           EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
           OR NOT EXISTS (
             SELECT 1 FROM target_permissions target
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
             )
           )
         )
       THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
    ).bind(actorAccountId, targetAccountId)
  }

  private prepareLastRootGuard(): D1PreparedStatement {
    return this.context.env.DB.prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM system_accounts account
         INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.status = 'active'
           AND identity.activated_at IS NOT NULL
           AND identity.revoked_at IS NULL
           AND binding.resource_type IS NULL
           AND binding.revoked_at IS NULL
           AND permission.permission_key = 'system:admin'
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
  }

  private toView(
    row: AccountRow,
    roleKeyRows: ReadonlyArray<RoleKeyRow>,
  ): SystemAccountAdministrationView | Error {
    const accountId = zAccountId.safeParse(row.id)
    if (!accountId.success) return new Error("System Account identifier is invalid")
    if (row.status !== "active" && row.status !== "suspended" && row.status !== "locked") {
      return new Error("System Account status is invalid")
    }
    if (
      typeof row.token_version !== "number" ||
      !Number.isSafeInteger(row.token_version) ||
      row.token_version < 0
    ) {
      return new Error("System Account token version is invalid")
    }
    if (
      typeof row.created_at !== "number" ||
      typeof row.updated_at !== "number" ||
      !Number.isSafeInteger(row.created_at) ||
      !Number.isSafeInteger(row.updated_at)
    ) {
      return new Error("System Account timestamp is invalid")
    }

    return Object.freeze({
      id: accountId.data,
      status: row.status,
      tokenVersion: row.token_version,
      roleKeys: Object.freeze(
        roleKeyRows.filter((entry) => entry.account_id === row.id).map((entry) => entry.role_key),
      ),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })
  }
}
