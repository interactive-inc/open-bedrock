import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { validateSystemPassword } from "@system/domain/auth/system-password-policy"
import {
  PasswordResetTokenInvalidApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { hashPasswordResetToken } from "@system/infrastructure/auth/hash-password-reset-token"
import { findSystemPasswordResetChallenge } from "@system/infrastructure/auth/find-system-password-reset-challenge"
import { completeSystemPasswordResetChallenge } from "@system/infrastructure/auth/complete-system-password-reset-challenge"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemPasswordHashContext,
  SystemRequestAuditContext,
} from "@system/infrastructure/configuration/system-context"

type Props = Readonly<{
  rawToken: string
  newPassword: string
}>

export class ResetPassword {
  static readonly featureId = "00450023"

  constructor(
    private readonly c: SystemD1Context &
      SystemClockContext &
      SystemPasswordHashContext &
      SystemRequestAuditContext,
  ) {}

  async execute(props: Props) {
    const now = this.c.var.now()
    if (validateSystemPassword(props.newPassword) !== null) {
      return new PasswordResetTokenInvalidApplicationError()
    }

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    const tokenHash = await hashPasswordResetToken(props.rawToken)
    if (tokenHash instanceof Error) return new PasswordResetTokenInvalidApplicationError()
    const challenge = await findSystemPasswordResetChallenge(this.c, tokenHash, now)
    if (challenge instanceof Error) return new SystemAuthPersistenceApplicationError(challenge)
    if (challenge === null) return new PasswordResetTokenInvalidApplicationError()
    const passwordHash = await PasswordHashService.hash(props.newPassword, this.c.env.PEPPER_SECRET)
    const metadataJson = toStableSystemAuditJson({
      client_ip: this.c.var.auditContext.clientIp,
      client_name: this.c.var.auditContext.clientName,
      request_id: this.c.var.auditContext.requestId,
    })
    if (metadataJson instanceof Error)
      return new SystemAuthPersistenceApplicationError(metadataJson)
    const completed = await completeSystemPasswordResetChallenge(this.c, {
      challengeId: challenge.id,
      tokenHash,
      accountId: challenge.accountId,
      identityId: challenge.identityId,
      accountTokenVersion: challenge.accountTokenVersion,
      passwordHash,
      completedAt: now,
      metadataJson,
    })

    if (completed instanceof Error) return new SystemAuthPersistenceApplicationError(completed)
    if (completed === false) return new PasswordResetTokenInvalidApplicationError()

    return {
      ok: true as const,
      accountId: challenge.accountId,
      accountTokenVersion: challenge.accountTokenVersion + 1,
    }
  }
}
