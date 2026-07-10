import { canManageAccounts } from "@/lib/iam/can-manage-accounts"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { hasPermissionSuperset } from "@/lib/iam/has-permission-superset"

const MIN_PASSWORD_LENGTH = 8

export type Command = {
  session: SessionPayload
  accountId: number
  newPassword: string
  now: number
}

export type Reset = { reason: "reset" }

/**
 * アカウントの password identity のパスワードを管理者が再設定する。account:manage 権限が必要。
 * 再設定後は tokenVersion を増やして既存トークンを失効させる。
 */
export class ResetAccountPassword {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Reset | ApplicationError> {
    if (canManageAccounts(command.session) === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    if (command.newPassword.length < MIN_PASSWORD_LENGTH) {
      return new ValidationError("password is too weak", "weak_password")
    }

    const targetAccount = await new AccountAuthRepository(this.c).resolveById(command.accountId)

    if (targetAccount instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: targetAccount })
    }

    if (targetAccount === null) {
      return new NotFoundError("account not found", "account_not_found")
    }

    if (hasPermissionSuperset(command.session, targetAccount.permissions) === false) {
      return new ForbiddenError("cannot reset a higher privilege account", "role_escalation")
    }

    const identityRepository = new IdentityRepository(this.c)

    const identityId = await identityRepository.findPasswordIdentityIdByAccount(command.accountId)

    if (identityId instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identityId })
    }

    if (identityId === null) {
      return new NotFoundError("password identity not found", "identity_not_found")
    }

    const hash = await toPasswordHash(command.newPassword)

    const updated = await identityRepository.updateSecretAndBumpTokenVersion(
      identityId,
      hash,
      command.accountId,
      command.now,
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to reset password", { cause: updated })
    }

    return { reason: "reset" }
  }
}
