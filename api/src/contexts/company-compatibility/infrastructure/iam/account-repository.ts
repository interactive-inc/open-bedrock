import type { Context } from "@/env"
import type { AccountStatus } from "@/contexts/system/domain/auth/account-status"
import { zAccountId } from "@system/domain/auth/account-id"
import { LastRootError } from "@/contexts/company-compatibility/infrastructure/iam/last-root-error"
import { LastRootGuard } from "@/contexts/company-compatibility/infrastructure/iam/last-root-guard"
import { LivePermissionGuard } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard"
import { LivePermissionGuardError } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard-error"
import {
  accountEmployeeLinks,
  employees,
} from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { inArray } from "drizzle-orm"

export type AccountSummary = {
  id: number
  employeeId: number | null
  employeeName: string | null
  status: string
  roleKeys: ReadonlyArray<string>
}

/**
 * System Accountの管理操作（一覧・取得・状態遷移・ロール割当）を扱うリポジトリ。
 * verify-bearer 用の AccountAuthRepository とは別に、管理画面向けの読み書きを担う。
 */
export class AccountRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * 全アカウントを従業員名・割当ロール付きで返す。
   */
  async listSummaries(): Promise<ReadonlyArray<AccountSummary> | Error> {
    try {
      const db = this.c.var.database
      const accountRows = await this.c.env.DB.prepare(
        "SELECT id, status FROM system_accounts ORDER BY id",
      ).all<{ id: string; status: string }>()

      const linkRows = await db.select().from(accountEmployeeLinks)
      const employeeIdByAccountId = new Map(
        linkRows.map((link) => [link.accountId, link.employeeId]),
      )

      const employeeIds = linkRows.map((link) => link.employeeId)

      const employeeRows =
        employeeIds.length === 0
          ? []
          : await db.select().from(employees).where(inArray(employees.id, employeeIds))

      const nameByEmployeeId = new Map(employeeRows.map((row) => [row.id, row.name]))

      const grantRows = await this.c.env.DB.prepare(
        `SELECT binding.account_id, role.key
         FROM system_role_bindings AS binding
         INNER JOIN system_iam_roles AS role ON role.id = binding.role_id
         WHERE binding.resource_type IS NULL AND binding.revoked_at IS NULL
         ORDER BY binding.account_id, role.key`,
      ).all<{ account_id: string; key: string }>()

      return accountRows.results.flatMap((account) => {
        const accountId = Number(account.id)
        if (!Number.isSafeInteger(accountId) || String(accountId) !== account.id) return []
        const employeeId = employeeIdByAccountId.get(zAccountId.parse(account.id)) ?? null

        return [
          {
            id: accountId,
            employeeId,
            employeeName: employeeId === null ? null : (nameByEmployeeId.get(employeeId) ?? null),
            status: account.status,
            roleKeys: grantRows.results
              .filter((grant) => grant.account_id === account.id)
              .map((grant) => grant.key.replace(/^company:/, "")),
          },
        ]
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list accounts")
    }
  }

  /**
   * アカウントの存在確認。不在は null。
   */
  async existsById(accountId: number): Promise<boolean | Error> {
    try {
      const found = await this.c.env.DB.prepare(
        "SELECT 1 AS found FROM system_accounts WHERE id = ?1 LIMIT 1",
      )
        .bind(String(accountId))
        .first<number>("found")
      return found === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find account")
    }
  }

  /**
   * アカウントにロールを付与する。冪等(既存なら無視)。
   */
  async grantRole(props: {
    accountId: number
    roleId: number
    grantedBy: number
    now: number
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT OR IGNORE INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`,
      )
        .bind(crypto.randomUUID(), String(props.accountId), String(props.roleId), props.now)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to grant role")
    }
  }

  /**
   * ロール付与と tokenVersion bump を原子的に行う。
   * 途中失敗でトークンが旧権限のまま残ることを防ぐ。
   */
  async grantRoleAndBumpTokenVersion(props: {
    accountId: number
    roleId: number
    grantedBy: number
    now: number
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.batch([
        new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleById({
          actorAccountId: props.grantedBy,
          targetRoleId: props.roleId,
          requiredPermissionKeys: ["iam:assign_roles"],
        }),
        this.c.env.DB.prepare(
          `INSERT OR IGNORE INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`,
        ).bind(crypto.randomUUID(), String(props.accountId), String(props.roleId), props.now),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
           WHERE id = ?1`,
        ).bind(String(props.accountId), props.now),
      ])

      return null
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught)) {
        return new LivePermissionGuardError({ cause: caught })
      }

      return caught instanceof Error ? caught : new Error("failed to grant role")
    }
  }

  /**
   * アカウントの状態を変更し、tokenVersion を増やして既存トークンを失効させる。
   */
  async setStatus(accountId: number, status: AccountStatus, now: number): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `UPDATE system_accounts
           SET status = ?2, token_version = token_version + 1, updated_at = max(updated_at, ?3)
           WHERE id = ?1`,
      )
        .bind(String(accountId), status, now)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to set account status")
    }
  }

  /**
   * ロールを剥奪し tokenVersion を増やす。剥奪の結果ログイン可能な実効管理者が 0 件に
   * なる場合は batch ごと rollback して LastRootError を返す。
   */
  async revokeRoleGuardingLastRoot(
    accountId: number,
    roleId: number,
    now: number,
    actorAccountId: number,
  ): Promise<null | Error | LastRootError> {
    try {
      await this.c.env.DB.batch([
        new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleById({
          actorAccountId,
          targetRoleId: roleId,
          requiredPermissionKeys: ["iam:assign_roles"],
        }),
        this.c.env.DB.prepare(
          `UPDATE system_role_bindings SET revoked_at = max(created_at, ?3)
           WHERE account_id = ?1 AND role_id = ?2
             AND resource_type IS NULL AND revoked_at IS NULL`,
        ).bind(String(accountId), String(roleId), now),
        new LastRootGuard(this.c).abortWhenNoLoginEnabledEffectiveRoot(),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
           WHERE id = ?1`,
        ).bind(String(accountId), now),
      ])

      return null
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught)) {
        return new LivePermissionGuardError({ cause: caught })
      }

      if (LastRootGuard.isAbortedBy(caught)) {
        return new LastRootError()
      }

      return caught instanceof Error ? caught : new Error("failed to revoke role")
    }
  }

  /**
   * アカウントを非アクティブ化し tokenVersion を増やす。結果ログイン可能な実効管理者が
   * 0 件になる場合は batch ごと rollback して LastRootError を返す（TOCTOU 防止）。
   */
  async setStatusGuardingLastRoot(
    accountId: number,
    status: AccountStatus,
    now: number,
    actorAccountId: number,
  ): Promise<null | Error | LastRootError> {
    try {
      await this.c.env.DB.batch([
        new LivePermissionGuard(this.c).abortWhenActorCannotManageAccount({
          actorAccountId,
          targetAccountId: accountId,
          requiredPermissionKeys: ["account:manage"],
        }),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET status = ?2, token_version = token_version + 1, updated_at = max(updated_at, ?3)
           WHERE id = ?1`,
        ).bind(String(accountId), status, now),
        new LastRootGuard(this.c).abortWhenNoLoginEnabledEffectiveRoot(),
      ])

      return null
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught)) {
        return new LivePermissionGuardError({ cause: caught })
      }

      if (LastRootGuard.isAbortedBy(caught)) {
        return new LastRootError()
      }

      return caught instanceof Error ? caught : new Error("failed to set account status")
    }
  }

  /**
   * tokenVersion を 1 増やし、updatedAt を更新する。発行済みトークンを即時失効させる。
   */
  async bumpTokenVersion(accountId: number, now: number): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `UPDATE system_accounts
           SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
           WHERE id = ?1`,
      )
        .bind(String(accountId), now)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to bump token version")
    }
  }

  /**
   * 従業員 id 群について、account_roles 由来の roleKeys を解決する。
   */
  async findRoleKeysByEmployeeIds(
    employeeIds: ReadonlyArray<number>,
  ): Promise<Map<number, ReadonlyArray<string>> | Error> {
    try {
      if (employeeIds.length === 0) {
        return new Map()
      }

      const rows = await this.c.env.DB.prepare(
        `SELECT link.employee_id, role.key
           FROM account_employee_links AS link
           INNER JOIN system_accounts AS account ON account.id = link.account_id
           INNER JOIN system_role_bindings AS binding ON binding.account_id = account.id
           INNER JOIN system_iam_roles AS role ON role.id = binding.role_id
           WHERE link.employee_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?1))
             AND binding.resource_type IS NULL
             AND binding.revoked_at IS NULL
           ORDER BY link.employee_id, role.key`,
      )
        .bind(JSON.stringify(employeeIds))
        .all<{ employee_id: number; key: string }>()

      const result = new Map<number, Array<string>>()

      for (const row of rows.results) {
        const existing = result.get(row.employee_id)
        const roleKey = row.key.replace(/^company:/, "")

        if (existing === undefined) {
          result.set(row.employee_id, [roleKey])
        } else {
          existing.push(roleKey)
        }
      }

      return result
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve role keys")
    }
  }

  /**
   * 従業員 id 1 件の roleKeys を解決する。不在は空配列。
   */
  async findRoleKeysByEmployeeId(employeeId: number): Promise<ReadonlyArray<string> | Error> {
    const resolved = await this.findRoleKeysByEmployeeIds([employeeId])

    if (resolved instanceof Error) {
      return resolved
    }

    return resolved.get(employeeId) ?? []
  }
}
