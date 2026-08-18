import type { AccountStatus } from "@system/domain/auth/account-status"
import { ResolveSystemAuthorization } from "@system/application/iam/resolve-system-authorization"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import type {
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization-repository"

export type ResolvedAccount = {
  accountId: number
  status: AccountStatus
  tokenVersion: number
  roleKeys: ReadonlyArray<string>
  permissions: ReadonlySet<string>
}

export type ResolvedAccountAuthorization = Pick<ResolvedAccount, "roleKeys" | "permissions">

/**
 * verify-bearer / 認証フローが使う、アカウントの認証・認可状態の解決。account 不在は null。
 * permission は accountRoles ⋈ roles ⋈ rolePermissions ⋈ permissions の和集合。
 */
export class AccountAuthRepository {
  constructor(
    private readonly c: SystemDatabaseContext &
      SystemD1Context & { env: { NOW?: string | number } },
  ) {
    Object.freeze(this)
  }

  async findById(accountId: number): Promise<
    | {
        accountId: number
        status: AccountStatus
        tokenVersion: number
      }
    | null
    | Error
  > {
    try {
      const account = await new SystemAccountRepository({ database: this.c.env.DB }).findById(
        zAccountId.parse(String(accountId)),
      )
      if (account === null || account instanceof Error) return account

      return {
        accountId,
        status: account.status,
        tokenVersion: account.tokenVersion,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find account")
    }
  }

  async resolveById(accountId: number): Promise<ResolvedAccount | null | Error> {
    const account = await this.findById(accountId)
    if (account === null || account instanceof Error) return account

    const authorization = await this.resolveAuthorizationById(accountId)
    if (authorization instanceof Error) return authorization

    return { ...account, ...authorization }
  }

  async resolveAuthorizationById(accountId: number): Promise<ResolvedAccountAuthorization | Error> {
    try {
      const authorization = await new ResolveSystemAuthorization(
        new SystemD1AuthorizationRepository({ env: { DB: this.c.env.DB } }),
      ).execute({
        accountId: zAccountId.parse(String(accountId)),
        resource: null,
        at: new Date(this.c.env.NOW ?? Date.now()),
      })
      if (authorization instanceof Error) return authorization
      if (authorization === null) {
        return { roleKeys: [], permissions: new Set() }
      }

      return {
        roleKeys: authorization.roleKeys.map((key) => key.replace(/^company:/, "")),
        permissions: authorization.permissionKeys,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve account")
    }
  }
}
