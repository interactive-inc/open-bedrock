import type { AccountRepository } from "@system/application/auth/account-repository"
import { createSystemSessionAudit } from "@system/application/auth/create-system-session-audit"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import type { SessionRepository } from "@system/application/auth/session-repository"
import type { SystemSessionAuditContext } from "@system/application/auth/system-session-audit-context"
import type { SystemSessionMaterialService } from "@system/application/auth/system-session-material-service"
import type { SystemAccessTokenIssuer } from "@system/application/auth/system-access-token-issuer"
import type { AccountId } from "@system/domain/auth/account-id"
import type { AccountSessionRejection } from "@system/domain/auth/get-account-session-rejection"
import type { SessionId } from "@system/domain/auth/session-id"
import { Session } from "@system/domain/auth/session.entity"

type Props = Readonly<{
  accountRepository: AccountRepository
  sessionRepository: SessionRepository
  materialService: SystemSessionMaterialService
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

/** canonical Accountを正本に、opaque Sessionと監査を同じ永続化境界で発行する。 */
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
      return new Error("System Session issuance time is invalid")
    }

    const accountSession = await resolveAccountSession({
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
    const session = Session.create({
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

    const audit = createSystemSessionAudit({
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
