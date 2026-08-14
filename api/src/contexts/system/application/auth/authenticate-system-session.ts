import type { AccountRepository } from "@system/application/auth/account-repository"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import type { SessionRepository } from "@system/application/auth/session-repository"
import type { SystemSessionMaterialService } from "@system/application/auth/system-session-material-service"
import type { AccountId } from "@system/domain/auth/account-id"
import type { SessionId } from "@system/domain/auth/session-id"

type Props = Readonly<{
  accountRepository: AccountRepository
  sessionRepository: SessionRepository
  materialService: Pick<SystemSessionMaterialService, "hashRawToken">
}>

export type AuthenticateSystemSessionCommand = Readonly<{
  rawToken: string
  now: Date
}>

export type AuthenticateSystemSessionResult =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      tokenVersion: number
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{ kind: "rejected"; reason: "invalid" }>

/** opaque tokenとcanonical AccountだけでSystem Sessionをfail closedに検証する。 */
export class AuthenticateSystemSession {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(
    command: AuthenticateSystemSessionCommand,
  ): Promise<AuthenticateSystemSessionResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System Session authentication time is invalid")
    }

    const tokenHash = await this.props.materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const session = await this.props.sessionRepository.findByTokenHash(tokenHash)
    if (session instanceof Error) return session
    if (session === null || session.getUseRejection(command.now) !== null) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    const accountSession = await resolveAccountSession({
      accountRepository: this.props.accountRepository,
      accountId: session.accountId,
      sessionTokenVersion: session.tokenVersion,
    })
    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: accountSession.account.id,
      tokenVersion: accountSession.account.tokenVersion,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    })
  }
}
