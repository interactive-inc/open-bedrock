import { canManageAccounts } from "@/lib/iam/can-manage-accounts"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"

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

    const identityRepository = new IdentityRepository(this.c)

    const identityId = await identityRepository.findPasswordIdentityIdByAccount(command.accountId)

    if (identityId instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identityId })
    }

    if (identityId === null) {
      return new NotFoundError("password identity not found", "identity_not_found")
    }

    const hash = await toPasswordHash(command.newPassword)

    const updated = await identityRepository.updateSecret(identityId, hash)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to reset password", { cause: updated })
    }

    const accountRepository = new AccountRepository(this.c)

    const bumped = await accountRepository.bumpTokenVersion(command.accountId, command.now)

    if (bumped instanceof Error) {
      return new UnexpectedError("failed to revoke sessions", { cause: bumped })
    }

    return { reason: "reset" }
  }
}
