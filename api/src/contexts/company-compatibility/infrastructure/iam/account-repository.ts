import type { Context } from "@/env"
import type { AccountStatus } from "@/contexts/system/domain/auth/account-status"
import { LastRootError } from "@/contexts/company-compatibility/infrastructure/iam/last-root-error"
import { LastRootGuard } from "@/contexts/company-compatibility/infrastructure/iam/last-root-guard"
import { LivePermissionGuard } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard"
import { LivePermissionGuardError } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard-error"
import {
  accountEmployeeLinks,
  employees,
} from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { accountRoles, accounts, roles } from "@/api/legacy-system/adapters/schema/system"
import { eq, inArray, sql } from "drizzle-orm"

export type AccountSummary = {
  id: number
  employeeId: number | null
  employeeName: string | null
  status: string
  roleKeys: ReadonlyArray<string>
}

/**
 * accounts の管理操作(一覧・取得・状態遷移・ロール割当)を扱うリポジトリ。
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

      const accountRows = await db.select().from(accounts)

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

      const grantRows = await db.select().from(accountRoles)

      const roleRows = await db.select().from(roles)

      const keyByRoleId = new Map(roleRows.map((row) => [row.id, row.key]))

      return accountRows.map((account) => {
        const employeeId = employeeIdByAccountId.get(account.id) ?? null

        return {
          id: account.id,
          employeeId,
          employeeName: employeeId === null ? null : (nameByEmployeeId.get(employeeId) ?? null),
          status: account.status,
          roleKeys: grantRows
            .filter((grant) => grant.accountId === account.id)
            .map((grant) => keyByRoleId.get(grant.roleId))
            .filter((key): key is string => key !== undefined),
        }
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
      const rows = await this.c.var.database
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1)

      return rows.length > 0
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
      await this.c.var.database
        .insert(accountRoles)
        .values({
          accountId: props.accountId,
          roleId: props.roleId,
          grantedBy: props.grantedBy,
          grantedAt: props.now,
        })
        .onConflictDoNothing()

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
          "INSERT OR IGNORE INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (?1, ?2, ?3, ?4)",
        ).bind(props.accountId, props.roleId, props.grantedBy, props.now),
        this.c.env.DB.prepare(
          "UPDATE accounts SET token_version = token_version + 1, updated_at = ?2 WHERE id = ?1",
        ).bind(props.accountId, props.now),
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
      await this.c.var.database
        .update(accounts)
        .set({ status: status, tokenVersion: sql`${accounts.tokenVersion} + 1`, updatedAt: now })
        .where(eq(accounts.id, accountId))

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
          "DELETE FROM account_roles WHERE account_id = ?1 AND role_id = ?2",
        ).bind(accountId, roleId),
        new LastRootGuard(this.c).abortWhenNoLoginEnabledEffectiveRoot(),
        this.c.env.DB.prepare(
          "UPDATE accounts SET token_version = token_version + 1, updated_at = ?2 WHERE id = ?1",
        ).bind(accountId, now),
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
          "UPDATE accounts SET status = ?2, token_version = token_version + 1, updated_at = ?3 WHERE id = ?1",
        ).bind(accountId, status, now),
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
      await this.c.var.database
        .update(accounts)
        .set({ tokenVersion: sql`${accounts.tokenVersion} + 1`, updatedAt: now })
        .where(eq(accounts.id, accountId))

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

      const rows = await this.c.var.database
        .select({ employeeId: accountEmployeeLinks.employeeId, roleKey: roles.key })
        .from(accounts)
        .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
        .innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
        .innerJoin(roles, eq(roles.id, accountRoles.roleId))
        .where(inArray(accountEmployeeLinks.employeeId, [...employeeIds]))

      const result = new Map<number, Array<string>>()

      for (const row of rows) {
        const existing = result.get(row.employeeId)

        if (existing === undefined) {
          result.set(row.employeeId, [row.roleKey])
        } else {
          existing.push(row.roleKey)
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
