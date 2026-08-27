import type {
  IssueSystemSessionCommand,
  IssueSystemSessionResult,
  SystemAccessTokenIssuer,
  SystemSessionMaterial,
} from "@system/domain/definitions/auth/system-session-issuance.definition"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SessionEntity } from "@system/domain/entities/session.entity"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import type { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"

export type SystemSessionIssuanceAdapterContext = Readonly<{
  accountRepository: Pick<SystemAccountRepository, "findById">
  sessionRepository: Pick<SystemSessionRepository, "createWithAudit">
  materialService: SystemSessionMaterial
  accessTokenIssuer: SystemAccessTokenIssuer
  sessionTtlMilliseconds: number
}>
type Context = SystemSessionIssuanceAdapterContext

/** システムセッションを発行する。 */
export class SystemSessionIssuanceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async issue(command: IssueSystemSessionCommand): Promise<IssueSystemSessionResult | Error> {
    const nowEpochMilliseconds = command.now.getTime()
    const expiresAtEpochMilliseconds = nowEpochMilliseconds + this.c.sessionTtlMilliseconds

    if (
      !Number.isSafeInteger(nowEpochMilliseconds) ||
      !Number.isSafeInteger(this.c.sessionTtlMilliseconds) ||
      this.c.sessionTtlMilliseconds <= 0 ||
      !Number.isSafeInteger(expiresAtEpochMilliseconds)
    ) {
      return new Error("System SessionEntity issuance time is invalid")
    }

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: this.c.accountRepository,
      accountId: command.accountId,
      sessionTokenVersion: command.tokenVersion,
    })

    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return Object.freeze({ kind: "rejected" as const, reason: accountSession.reason })
    }

    const sessionId = this.c.materialService.generateSessionId()
    if (sessionId instanceof Error) return sessionId
    const familyId = this.c.materialService.generateFamilyId()
    if (familyId instanceof Error) return familyId
    const rawToken = this.c.materialService.generateRawToken()
    if (rawToken instanceof Error) return rawToken
    const tokenHash = await this.c.materialService.hashRawToken(rawToken)
    if (tokenHash instanceof Error) return tokenHash

    const expiresAt = new Date(expiresAtEpochMilliseconds)
    const session = SessionEntity.create({
      id: sessionId,
      accountId: accountSession.account.id,
      familyId,
      tokenHash,
      tokenVersion: accountSession.account.tokenVersion,
      createdAt: command.now,
      expiresAt,
      rotatedAt: null,
      revokedAt: null,
    })
    if (session instanceof Error) return session

    const audit = SystemAuditEventEntity.createSession({
      actorAccountId: session.accountId,
      action: "auth.session.create",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit

    const accessToken = await this.c.accessTokenIssuer.issue({
      accountId: session.accountId,
      tokenVersion: session.tokenVersion,
      now: command.now,
    })
    if (accessToken instanceof Error) return accessToken

    const creationError = await this.c.sessionRepository.createWithAudit(session, audit)
    if (creationError instanceof Error) return creationError

    return Object.freeze({
      kind: "issued" as const,
      accountId: session.accountId,
      tokenVersion: session.tokenVersion,
      accessToken,
      rawToken,
      sessionId: session.id,
      expiresAt,
    })
  }
}
