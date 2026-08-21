import type { SystemAuditEventAppender } from "@system/infrastructure/audit/system-audit-event-appender.repository"
import type { AccountRepository } from "@system/infrastructure/auth/account-port.repository"
import { createSystemSessionAudit } from "@system/domain/audit/create-system-session-audit"
import { createSystemSessionRotationAudits } from "@system/domain/audit/create-system-session-rotation-audits"
import { resolveAccountSession } from "@system/domain/auth/resolve-account-session"
import type { SessionRepository } from "@system/infrastructure/auth/session-port.repository"
import type { SystemSessionAuditContext } from "@system/domain/auth/system-session-audit-context"
import type { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material-port.repository"
import type { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer-port.repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type { SessionId } from "@system/domain/auth/session-id"
import { SessionRotation } from "@system/domain/auth/session-rotation"
import { Session } from "@system/domain/auth/session.entity"

type Props = Readonly<{
  accountRepository: AccountRepository
  sessionRepository: SessionRepository
  auditAppender: SystemAuditEventAppender
  materialService: SystemSessionMaterialService
  accessTokenIssuer: SystemAccessTokenIssuer
  sessionTtlMilliseconds: number
}>

export type RotateSystemSessionCommand = Readonly<{
  rawToken: string
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type RotateSystemSessionResult =
  | Readonly<{
      kind: "rotated"
      accountId: AccountId
      tokenVersion: number
      accessToken: string
      rawToken: string
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{ kind: "rejected"; reason: "reused" | "invalid" }>

/** raw tokenを即時hash化し、rotation・reuse検知・family失効を共通契約で実行する。 */
export class RotateSystemSession {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(command: RotateSystemSessionCommand): Promise<RotateSystemSessionResult | Error> {
    const nowEpochMilliseconds = command.now.getTime()
    const expiresAtEpochMilliseconds = nowEpochMilliseconds + this.props.sessionTtlMilliseconds

    if (
      !Number.isSafeInteger(nowEpochMilliseconds) ||
      !Number.isSafeInteger(this.props.sessionTtlMilliseconds) ||
      this.props.sessionTtlMilliseconds <= 0 ||
      !Number.isSafeInteger(expiresAtEpochMilliseconds)
    ) {
      return new Error("System Session rotation time is invalid")
    }

    const tokenHash = await this.props.materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const current = await this.props.sessionRepository.findByTokenHash(tokenHash)
    if (current instanceof Error) return current
    if (current === null) return this.rejectUnknown(command)

    const useRejection = current.getUseRejection(command.now)
    if (useRejection === "rotated" || useRejection === "revoked") {
      return this.rejectKnown(current, "reused", command)
    }
    if (useRejection !== null) return this.rejectKnown(current, "invalid", command)

    const accountSession = await resolveAccountSession({
      accountRepository: this.props.accountRepository,
      accountId: current.accountId,
      sessionTokenVersion: current.tokenVersion,
    })
    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return this.rejectKnown(current, "invalid", command)
    }

    const sessionId = this.props.materialService.generateSessionId()
    if (sessionId instanceof Error) return sessionId
    const rawToken = this.props.materialService.generateRawToken()
    if (rawToken instanceof Error) return rawToken
    const successorTokenHash = await this.props.materialService.hashRawToken(rawToken)
    if (successorTokenHash instanceof Error) return successorTokenHash

    const expiresAt = new Date(expiresAtEpochMilliseconds)
    const successor = Session.create({
      id: sessionId,
      accountId: current.accountId,
      familyId: current.familyId,
      tokenHash: successorTokenHash,
      tokenVersion: accountSession.account.tokenVersion,
      createdAt: command.now,
      expiresAt,
      rotatedAt: null,
      revokedAt: null,
    })
    if (successor instanceof Error) return successor

    const rotation = SessionRotation.create(current, successor, command.now)
    if (rotation instanceof Error) return rotation
    const audits = createSystemSessionRotationAudits(rotation, command.auditContext)
    if (audits instanceof Error) return audits

    const accessToken = await this.props.accessTokenIssuer.issue({
      accountId: successor.accountId,
      tokenVersion: successor.tokenVersion,
      now: command.now,
    })
    if (accessToken instanceof Error) return accessToken

    const decision = await this.props.sessionRepository.rotateWithAudit(rotation, audits)
    if (decision instanceof Error) return decision
    if (decision !== "rotated") {
      return Object.freeze({ kind: "rejected" as const, reason: decision })
    }

    return Object.freeze({
      kind: "rotated" as const,
      accountId: successor.accountId,
      tokenVersion: successor.tokenVersion,
      accessToken,
      rawToken,
      sessionId: successor.id,
      expiresAt,
    })
  }

  private async rejectUnknown(
    command: RotateSystemSessionCommand,
  ): Promise<RotateSystemSessionResult | Error> {
    const audit = createSystemSessionAudit({
      actorAccountId: null,
      action: "auth.session.rotate",
      targetId: null,
      outcome: "denied",
      reasonCode: "session_invalid",
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit
    const appendError = await this.props.auditAppender.append(audit)

    return appendError instanceof Error
      ? appendError
      : Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
  }

  private async rejectKnown(
    current: Session,
    reason: "reused" | "invalid",
    command: RotateSystemSessionCommand,
  ): Promise<RotateSystemSessionResult | Error> {
    const audit = createSystemSessionAudit({
      actorAccountId: current.accountId,
      action: "auth.session.rotate",
      targetId: current.id,
      outcome: "denied",
      reasonCode: reason === "reused" ? "refresh_token_reused" : "session_invalid",
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit
    const revocationError = await this.props.sessionRepository.revokeFamilyWithAudit({
      familyId: current.familyId,
      revokedAt: command.now,
      audit,
    })

    return revocationError instanceof Error
      ? revocationError
      : Object.freeze({ kind: "rejected" as const, reason })
  }
}
