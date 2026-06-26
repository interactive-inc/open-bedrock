import type { Context } from "@/env"
import { accountRoles, accounts, employees, roles } from "@/schema"
import { eq, inArray } from "drizzle-orm"

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
}
