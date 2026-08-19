import type { SystemAuthorization } from "@system/domain/iam/system-authorization"
import { validateSystemPassword } from "@system/domain/auth/system-password-policy"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemPasswordHashContext,
  SystemRequestAuditContext,
} from "@system/infrastructure/configuration/system-context"
import { PasswordIdentityRepository } from "@system/infrastructure/auth/password-identity-repository"
import { AccountAuthRepository } from "@/contexts/company/application/auth/account-auth-repository"
import { hasSystemPermissionSuperset } from "@system/domain/iam/has-system-permission-superset"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { zAccountId } from "@system/domain/auth/account-id"
import type { AccountId } from "@system/domain/auth/account-id"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"

export type Command = {
  session: SystemAuthorization<AccountId>
  accountId: AccountId
  newPassword: string
  now: number
}

export type Reset = { reason: "reset" }

/**
 * Product APIのopaque Account commandをcanonical System password resetへ接続する。
 * 再設定後は tokenVersion を増やして既存トークンを失効させる。
 */
export class ResetAccountPassword {
  constructor(
    private readonly c: SystemDatabaseContext &
      SystemD1Context &
      SystemPasswordHashContext &
      SystemRequestAuditContext,
  ) {}

  async run(command: Command): Promise<Reset | ApplicationError> {
    if (command.session.hasPermission("account:manage") === false) {
      return new ForbiddenError("cannot manage accounts", "forbidden")
    }

    const passwordViolation = validateSystemPassword(command.newPassword)
    if (passwordViolation !== null) {
      return new ValidationError(
        "password must be between 12 and 200 characters",
        passwordViolation,
      )
    }
    const pepper = this.c.env.PEPPER_SECRET
    if (pepper === undefined || pepper === "") {
      return new UnexpectedError("password reset is unavailable")
    }

    const targetAccount = await new AccountAuthRepository(this.c).resolveById(command.accountId)

    if (targetAccount instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: targetAccount })
    }

    if (targetAccount === null) {
      return new NotFoundError("account not found", "account_not_found")
    }

    if (hasSystemPermissionSuperset(command.session, targetAccount.permissions) === false) {
      return new ForbiddenError("cannot reset a higher privilege account", "role_escalation")
    }

    const identityRepository = new PasswordIdentityRepository(this.c)

    const accountId = zAccountId.parse(command.accountId)
    const identityId = await identityRepository.findIdByAccount(accountId)

    if (identityId instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identityId })
    }

    if (identityId === null) {
      return new NotFoundError("password identity not found", "identity_not_found")
    }

    const hash = await PasswordHashService.hash(command.newPassword, pepper)

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
      accountId,
      command.now,
      auditStatements,
    )

    if (updated instanceof Error) {
      return new UnexpectedError("failed to reset password", { cause: updated })
    }

    return { reason: "reset" }
  }
}
