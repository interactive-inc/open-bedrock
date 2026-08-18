import type { SystemAuthorization } from "@/contexts/system-compatibility/application/iam/system-authorization"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { validatePasswordComplexity } from "@/contexts/system-compatibility/application/auth/password-policy"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemRequestAuditContext,
} from "@system/infrastructure/configuration/system-context"
import { PasswordIdentityRepository } from "@/contexts/system-compatibility/infrastructure/auth/password-identity-repository"
import { AccountAuthRepository } from "@/contexts/system-compatibility/infrastructure/auth/account-auth-repository"
import { hasPermissionSuperset } from "@/contexts/system-compatibility/application/iam/has-permission-superset"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"

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
  constructor(
    private readonly c: SystemDatabaseContext & SystemD1Context & SystemRequestAuditContext,
  ) {}

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
      const metadataJson = toStableSystemAuditJson({
        client_ip: this.c.var.auditContext.clientIp,
        client_name: this.c.var.auditContext.clientName,
        request_id: this.c.var.auditContext.requestId,
      })
      if (metadataJson instanceof Error) {
        return new UnexpectedError("failed to prepare password reset audit", {
          cause: metadataJson,
        })
      }

      const audit = createSystemAuditEvent({
        actorAccountId: String(command.session.accountId),
        action: "iam.account.password_reset",
        targetType: "account",
        targetId: String(command.accountId),
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson,
        occurredAt: new Date(command.now),
      })
      if (audit instanceof Error) {
        return new UnexpectedError("failed to prepare password reset audit", { cause: audit })
      }
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
