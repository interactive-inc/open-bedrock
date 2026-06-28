import { canManageAccounts } from "@/lib/iam/can-manage-accounts"
import { accountStatusSchema } from "@/lib/schemas"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { LastAdminError } from "@/infrastructure/iam/last-admin-error"

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

    // 非アクティブ化で唯一の admin を失う(system lockout)のを防ぐ。
    // 事前チェックは親切なエラー用、最終防御は原子的 batch の LastAdminError(TOCTOU 防止)。
    if (parsedStatus.data !== "active") {
      const targetIsAdmin = await accountRepository.accountHasSystemRole(command.accountId, "admin")

      if (targetIsAdmin instanceof Error) {
        return new UnexpectedError("failed to check account role", { cause: targetIsAdmin })
      }

      if (targetIsAdmin === true) {
        const updated = await accountRepository.setStatusGuardingLastAdmin(
          command.accountId,
          parsedStatus.data,
          command.now,
        )

        if (updated instanceof LastAdminError) {
          return new ConflictError("cannot deactivate the last admin", "last_admin")
        }

        if (updated instanceof Error) {
          return new UnexpectedError("failed to set account status", { cause: updated })
        }

        return { reason: "updated" }
      }
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
