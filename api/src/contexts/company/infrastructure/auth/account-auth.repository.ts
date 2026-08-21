import type { AccountStatus } from "@system/domain/auth/account-status"
import type { AccountId } from "@system/domain/auth/account-id"
import { resolveSystemAuthorization } from "@system/domain/iam/resolve-system-authorization"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import type {
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context.repository"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization.repository"

export type ResolvedAccount = {
  accountId: AccountId
  status: AccountStatus
  tokenVersion: number
  roleKeys: ReadonlyArray<string>
  permissions: ReadonlySet<string>
}

export type ResolvedAccountAuthorization = Pick<ResolvedAccount, "roleKeys" | "permissions">

/** Product APIのopaque Account IDをcanonical System認証・認可へ接続する。 */
export class AccountAuthRepository {
  constructor(
    private readonly c: SystemDatabaseContext &
      SystemD1Context & { env: { NOW?: string | number } },
  ) {
    Object.freeze(this)
  }

  async findById(accountId: AccountId): Promise<
    | {
        accountId: AccountId
        status: AccountStatus
        tokenVersion: number
      }
    | null
    | Error
  > {
    try {
      const account = await new SystemAccountRepository({ database: this.c.env.DB }).findById(
        accountId,
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

  async resolveById(accountId: AccountId): Promise<ResolvedAccount | null | Error> {
    const account = await this.findById(accountId)
    if (account === null || account instanceof Error) return account

    const authorization = await this.resolveAuthorizationById(accountId)
    if (authorization instanceof Error) return authorization

    return { ...account, ...authorization }
  }

  async resolveAuthorizationById(
    accountId: AccountId,
  ): Promise<ResolvedAccountAuthorization | Error> {
    try {
      const authorizationGraph = await new SystemD1AuthorizationRepository({
        env: { DB: this.c.env.DB },
      }).loadForAccount(accountId)
      if (authorizationGraph instanceof Error) return authorizationGraph
      if (authorizationGraph === null) {
        return { roleKeys: [], permissions: new Set() }
      }
      const authorization = resolveSystemAuthorization(authorizationGraph, {
        resource: null,
        at: new Date(this.c.env.NOW ?? Date.now()),
      })
      if (authorization instanceof Error) return authorization

      return {
        roleKeys: authorization.roleKeys.map((key) => key.replace(/^company:/, "")),
        permissions: authorization.permissionKeys,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve account")
    }
  }
}
