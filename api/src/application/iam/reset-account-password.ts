import type { SystemAuthorization } from "@/application/system/iam/system-authorization"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { validatePasswordComplexity } from "@/application/auth/password-policy"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { PasswordIdentityRepository } from "@/infrastructure/system/auth/password-identity-repository"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { hasPermissionSuperset } from "@/application/iam/has-permission-superset"
import { createSystemAuditEvent } from "@/composition/audit/system-audit-event"
import { SystemAuditEventRepository } from "@/infrastructure/system/audit/system-audit-event-repository"

export type Command = {
  session: SystemAuthorization<number>
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
    if (command.session.hasPermission("account:manage") === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    const passwordError = validatePasswordComplexity(command.newPassword)
    if (passwordError !== null) return passwordError

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

    const identityRepository = new PasswordIdentityRepository(this.c)

    const identityId = await identityRepository.findIdByAccount(command.accountId)

    if (identityId instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identityId })
    }

    if (identityId === null) {
      return new NotFoundError("password identity not found", "identity_not_found")
    }

    const hash = await toPasswordHash(command.newPassword)

    let auditStatements: ReturnType<SystemAuditEventRepository["prepareAppend"]>
    try {
      const audit = createSystemAuditEvent(
        {
          actorAccountId: command.session.accountId,
          action: "iam.account.password_reset",
          target: { type: "account", id: String(command.accountId) },
          outcome: "succeeded",
          reasonCode: null,
          now: new Date(command.now),
        },
        this.c.var.auditContext,
      )
      auditStatements = new SystemAuditEventRepository(this.c).prepareAppend(audit)
    } catch (cause) {
      return new UnexpectedError("failed to prepare password reset audit", { cause })
    }

    const updated = await identityRepository.updateSecretAndBumpTokenVersion(
      identityId,
      hash,
      command.accountId,
      command.now,
      auditStatements,
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to reset password", { cause: updated })
    }

    return { reason: "reset" }
  }
}
