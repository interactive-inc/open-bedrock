import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { accountStatusSchema } from "@/contexts/system/domain/auth/account-status"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { AccountRepository } from "@/contexts/company-compatibility/infrastructure/iam/account-repository"
import { AccountAuthRepository } from "@/api/legacy-system/adapters/auth/account-auth-repository"
import { LastRootError } from "@/contexts/company-compatibility/infrastructure/iam/last-root-error"
import { LivePermissionGuardError } from "@/contexts/company-compatibility/infrastructure/iam/live-permission-guard-error"
import { hasPermissionSuperset } from "@/api/legacy-system/use-cases/iam/has-permission-superset"

export type Command = {
  session: Session
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
    if (command.session.hasPermission("account:manage") === false) {
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

    const targetAccount = await new AccountAuthRepository(this.c).resolveById(command.accountId)

    if (targetAccount instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: targetAccount })
    }

    if (targetAccount === null) {
      return new NotFoundError("account not found", "account_not_found")
    }

    if (hasPermissionSuperset(command.session, targetAccount.permissions) === false) {
      return new ForbiddenError("cannot change a higher privilege account", "role_escalation")
    }

    // live permission・状態変更・実効管理者検査を同じ batch で確定する。
    const updated = await accountRepository.setStatusGuardingLastRoot(
      command.accountId,
      parsedStatus.data,
      command.now,
      command.session.accountId,
    )

    if (updated instanceof LastRootError) {
      return new ConflictError("cannot deactivate the last effective admin", "last_admin")
    }

    if (updated instanceof LivePermissionGuardError) {
      return new ForbiddenError("cannot change a higher privilege account", "role_escalation")
    }

    if (updated instanceof Error) {
      return new UnexpectedError("failed to set account status", { cause: updated })
    }

    return { reason: "updated" }
  }
}
