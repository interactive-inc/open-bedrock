import type { Context } from "@/env"
import type { AccountStatus } from "@/lib/schemas"
import { accountRoles, accounts, employees, roles } from "@/schema"
import { and, count, eq, inArray, sql } from "drizzle-orm"

// IAM のアカウント管理(一覧・取得・状態遷移・ロール割当)を扱う。
// verify-bearer 用の AccountAuthRepository とは別に、管理画面向けの読み書きを担う。

export type AccountSummary = {
  id: number
  employeeId: number | null
  employeeName: string | null
  status: string
  roleKeys: ReadonlyArray<string>
}

/**
 * accounts の管理操作を扱うリポジトリ。
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

      const employeeIds = accountRows
        .map((row) => row.employeeId)
        .filter((id): id is number => id !== null)

      const employeeRows =
        employeeIds.length === 0
          ? []
          : await db.select().from(employees).where(inArray(employees.id, employeeIds))

      const nameByEmployeeId = new Map(employeeRows.map((row) => [row.id, row.name]))

      const grantRows = await db.select().from(accountRoles)

      const roleRows = await db.select().from(roles)

      const keyByRoleId = new Map(roleRows.map((row) => [row.id, row.key]))

      return accountRows.map((account) => ({
        id: account.id,
        employeeId: account.employeeId,
        employeeName:
          account.employeeId === null ? null : (nameByEmployeeId.get(account.employeeId) ?? null),
        status: account.status,
        roleKeys: grantRows
          .filter((grant) => grant.accountId === account.id)
          .map((grant) => keyByRoleId.get(grant.roleId))
          .filter((key): key is string => key !== undefined),
      }))
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
   * アカウントからロールを剥奪する。
   */
  async revokeRole(accountId: number, roleId: number): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(accountRoles)
        .where(and(eq(accountRoles.accountId, accountId), eq(accountRoles.roleId, roleId)))

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to revoke role")
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
        .select({ employeeId: accounts.employeeId, roleKey: roles.key })
        .from(accounts)
        .innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
        .innerJoin(roles, eq(roles.id, accountRoles.roleId))
        .where(inArray(accounts.employeeId, [...employeeIds]))

      const result = new Map<number, Array<string>>()

      for (const row of rows) {
        if (row.employeeId === null) {
          continue
        }

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

  /**
   * 指定した system role を保持するアカウント数を数える。
   */
  async countAccountsWithSystemRole(roleKey: string): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(accountRoles)
        .innerJoin(roles, eq(roles.id, accountRoles.roleId))
        .where(and(eq(roles.key, roleKey), eq(roles.isSystem, 1)))

      return rows.at(0)?.value ?? 0
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to count accounts by role")
    }
  }
}
