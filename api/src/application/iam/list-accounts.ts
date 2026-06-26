import { canManageAccounts } from "@/lib/iam/can-manage-accounts"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import type { AccountSummary } from "@/infrastructure/iam/account-repository"
import { AccountRepository } from "@/infrastructure/iam/account-repository"

export type Command = {
  session: SessionPayload
}

/**
 * アカウント一覧を従業員名・割当ロール付きで返す。account:manage 権限が必要。
 */
export class ListAccounts {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<AccountSummary> | ApplicationError> {
    if (canManageAccounts(command.session) === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    const accountRepository = new AccountRepository(this.c)

    const found = await accountRepository.listSummaries()

    if (found instanceof Error) {
      return new UnexpectedError("failed to list accounts", { cause: found })
    }

    return found
  }
}
