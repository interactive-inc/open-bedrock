import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import type { SystemSessionAuditContext } from "@system/domain/definitions/audit/system-session-audit-context.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { AccountSessionRejection } from "@system/domain/policies/account-session.policy"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import type { SessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import { SessionEntity } from "@system/domain/entities/session.entity"
import type { SystemSessionRepository } from "@system/infrastructure/auth/system-session.repository"

export type SystemSessionMaterial = Readonly<{
  generateSessionId: () => SessionId | Error
  generateFamilyId: () => SessionFamilyId | Error
  generateRawToken: () => string | Error
  hashRawToken: (rawToken: string) => Promise<SessionTokenHash | Error>
}>

export type SystemAccessTokenIssuer = Readonly<{
  issue: (
    input: Readonly<{ accountId: AccountId; tokenVersion: number; now: Date }>,
  ) => Promise<string | Error>
}>

type Props = Readonly<{
  accountRepository: Pick<SystemAccountRepository, "findById">
  sessionRepository: Pick<SystemSessionRepository, "createWithAudit">
  materialService: SystemSessionMaterial
  accessTokenIssuer: SystemAccessTokenIssuer
  sessionTtlMilliseconds: number
}>

export type IssueSystemSessionCommand = Readonly<{
  accountId: AccountId
  tokenVersion: number
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type IssueSystemSessionResult =
  | Readonly<{
      kind: "issued"
      accountId: AccountId
      tokenVersion: number
      accessToken: string
      rawToken: string
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{
      kind: "rejected"
      reason: AccountSessionRejection | "account_not_found"
    }>

/** canonical Accountを正本に、opaque SessionEntityと監査を同じ永続化境界で発行する。 */
export class IssueSystemSession {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(command: IssueSystemSessionCommand): Promise<IssueSystemSessionResult | Error> {
    const nowEpochMilliseconds = command.now.getTime()
    const expiresAtEpochMilliseconds = nowEpochMilliseconds + this.props.sessionTtlMilliseconds

    if (
      !Number.isSafeInteger(nowEpochMilliseconds) ||
      !Number.isSafeInteger(this.props.sessionTtlMilliseconds) ||
      this.props.sessionTtlMilliseconds <= 0 ||
      !Number.isSafeInteger(expiresAtEpochMilliseconds)
    ) {
      return new Error("System SessionEntity issuance time is invalid")
    }

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: this.props.accountRepository,
      accountId: command.accountId,
      sessionTokenVersion: command.tokenVersion,
    })

    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return Object.freeze({ kind: "rejected" as const, reason: accountSession.reason })
    }

    const sessionId = this.props.materialService.generateSessionId()
    if (sessionId instanceof Error) return sessionId
    const familyId = this.props.materialService.generateFamilyId()
    if (familyId instanceof Error) return familyId
    const rawToken = this.props.materialService.generateRawToken()
    if (rawToken instanceof Error) return rawToken
    const tokenHash = await this.props.materialService.hashRawToken(rawToken)
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

    const accessToken = await this.props.accessTokenIssuer.issue({
      accountId: session.accountId,
      tokenVersion: session.tokenVersion,
      now: command.now,
    })
    if (accessToken instanceof Error) return accessToken

    const creationError = await this.props.sessionRepository.createWithAudit(session, audit)
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
