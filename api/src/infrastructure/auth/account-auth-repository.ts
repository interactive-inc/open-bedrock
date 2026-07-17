import type { Context } from "@/env"
import { accountRoles, accounts, permissions, rolePermissions, roles } from "@/schema"
import { eq, inArray } from "drizzle-orm"

// verify-bearer / 認証フローが使う、アカウントの認証・認可状態の解決。
// account 取得と、accountRoles→roles→rolePermissions→permissions を畳んだ
// permissions Set / roleKeys の構築を担う。

export type ResolvedAccount = {
  accountId: number
  employeeId: number | null
  status: string
  tokenVersion: number
  roleKeys: ReadonlyArray<string>
  permissions: ReadonlySet<string>
}

/**
 * アカウントの認証・認可状態を解決する。account 不在は null。
 * permission は accountRoles ⋈ roles ⋈ rolePermissions ⋈ permissions の和集合。
 */
export class AccountAuthRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findById(accountId: number): Promise<
    | {
        accountId: number
        employeeId: number | null
        status: string
        tokenVersion: number
      }
    | null
    | Error
  > {
    try {
      const db = this.c.var.database

      const rows = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)

      const account = rows.at(0)

      if (account === undefined) {
        return null
      }

      return {
        accountId: account.id,
        employeeId: account.employeeId,
        status: account.status,
        tokenVersion: account.tokenVersion,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find account")
    }
  }

  async resolveById(accountId: number): Promise<ResolvedAccount | null | Error> {
    try {
      const db = this.c.var.database

      const accountRows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1)

      const account = accountRows.at(0)

      if (account === undefined) {
        return null
      }

      const grantedRoles = await db
        .select()
        .from(accountRoles)
        .where(eq(accountRoles.accountId, accountId))

      const roleIds = grantedRoles.map((row) => row.roleId)

      const roleRows =
        roleIds.length === 0 ? [] : await db.select().from(roles).where(inArray(roles.id, roleIds))

      const roleKeys = roleRows.map((row) => row.key)

      const permissionKeys = await this.toPermissionKeys(roleIds)

      return {
        accountId: account.id,
        employeeId: account.employeeId,
        status: account.status,
        tokenVersion: account.tokenVersion,
        roleKeys: roleKeys,
        permissions: new Set(permissionKeys),
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve account")
    }
  }

  private async toPermissionKeys(roleIds: ReadonlyArray<number>): Promise<ReadonlyArray<string>> {
    if (roleIds.length === 0) {
      return []
    }

    const db = this.c.var.database

    // permission 数が D1 のバインド変数上限(100)を超えるため、permission ID の
    // inArray ではなく join で解決する。バインド変数はロール数だけに依存する。
    const grantRows = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(inArray(rolePermissions.roleId, [...roleIds]))

    return grantRows.map((row) => row.key)
  }
}
