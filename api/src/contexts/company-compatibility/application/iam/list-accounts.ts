import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import type { AccountSummary } from "@/contexts/company-compatibility/infrastructure/iam/account-repository"
import { AccountRepository } from "@/contexts/company-compatibility/infrastructure/iam/account-repository"
import { AccountAuthRepository } from "@/contexts/system-compatibility/infrastructure/auth/account-auth-repository"
import { hasPermissionSuperset } from "@/contexts/system-compatibility/application/iam/has-permission-superset"

export type AccountAccessSummary = AccountSummary & {
  canManage: boolean
  isSelf: boolean
}

export type Command = {
  session: Session
}

/**
 * アカウント一覧を従業員名・割当ロール付きで返す。account:manage 権限が必要。
 */
export class ListAccounts {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<AccountAccessSummary> | ApplicationError> {
    if (command.session.hasPermission("account:manage") === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    const accountRepository = new AccountRepository(this.c)

    const found = await accountRepository.listSummaries()

    if (found instanceof Error) {
      return new UnexpectedError("failed to list accounts", { cause: found })
    }

    const authRepository = new AccountAuthRepository(this.c)

    const withAccess = await Promise.all(
      found.map(async (account) => ({
        account: account,
        resolved: await authRepository.resolveById(account.id),
      })),
    )

    const failed = withAccess.find(
      (entry) => entry.resolved instanceof Error || entry.resolved === null,
    )

    if (failed !== undefined) {
      return new UnexpectedError("failed to resolve account permissions", {
        cause:
          failed.resolved instanceof Error
            ? failed.resolved
            : new Error("account disappeared while listing"),
      })
    }

    return withAccess.map(({ account, resolved }) => ({
      ...account,
      canManage:
        resolved !== null &&
        !(resolved instanceof Error) &&
        hasPermissionSuperset(command.session, resolved.permissions),
      isSelf: account.id === command.session.accountId,
    }))
  }
}
