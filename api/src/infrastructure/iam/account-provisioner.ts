import type { Context } from "@/env"
import { accountRoles, accounts, identities, roles } from "@/schema"
import { eq } from "drizzle-orm"

// 従業員に対応する account / password identity / 初期ロールを作成する。
// 新規従業員登録(register-employee)が認証情報を identities へ書くために使う。
// backfill(0005_iam_backfill.sql)のアプリ層版で、employees の認証列に依存しない。

export type ProvisionInput = {
  employeeId: number
  email: string
  passwordHash: string
  roleKey: string
  now: number
}

/**
 * 従業員のアカウント・identity・初期ロールを払い出す。
 */
export class AccountProvisioner {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async provision(input: ProvisionInput): Promise<null | Error> {
    try {
      const db = this.c.var.database

      const accountRows = await db
        .insert(accounts)
        .values({
          employeeId: input.employeeId,
          status: "active",
          tokenVersion: 0,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning()

      const account = accountRows.at(0)

      if (account === undefined) {
        return new Error("failed to create account")
      }

      await db.insert(identities).values({
        accountId: account.id,
        provider: "password",
        subject: input.email.toLowerCase(),
        secret: input.passwordHash,
        email: input.email,
        emailVerified: 1,
        createdAt: input.now,
      })

      const roleRows = await db.select().from(roles).where(eq(roles.key, input.roleKey)).limit(1)

      const role = roleRows.at(0)

      if (role !== undefined) {
        await db.insert(accountRoles).values({
          accountId: account.id,
          roleId: role.id,
          grantedBy: null,
          grantedAt: input.now,
        })
      }

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision account")
    }
  }
}
