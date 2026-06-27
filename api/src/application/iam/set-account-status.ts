import { canManageAccounts } from "@/lib/iam/can-manage-accounts"
import { accountStatusSchema } from "@/lib/schemas"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { AccountRepository } from "@/infrastructure/iam/account-repository"

export type Command = {
  session: SessionPayload
  accountId: number
  status: string
  now: number
}

export type Updated = { reason: "updated" }

/**
 * アカウントの状態(active/suspended/locked)を変更する。account:manage 権限が必要。
 * 自分のアカウントは停止・ロックできない(self-lockout 防止)。状態変更で既存トークンを失効させる。
 */
export class SetAccountStatus {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Updated | ApplicationError> {
    if (canManageAccounts(command.session) === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    const parsedStatus = accountStatusSchema.safeParse(command.status)

    if (parsedStatus.success === false) {
      return new ValidationError("invalid account status", "invalid_status")
    }

    if (command.accountId === command.session.accountId && parsedStatus.data !== "active") {
      return new ForbiddenError("cannot deactivate your own account", "self_deactivation")
    }

    const accountRepository = new AccountRepository(this.c)

    const exists = await accountRepository.existsById(command.accountId)

    if (exists instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: exists })
    }

    if (exists === false) {
      return new NotFoundError("account not found", "account_not_found")
    }

    const updated = await accountRepository.setStatus(
      command.accountId,
      parsedStatus.data,
      command.now,
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to set account status", { cause: updated })
    }

    return { reason: "updated" }
  }
}
