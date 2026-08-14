import { createSystemSessionAudit } from "@system/application/auth/create-system-session-audit"
import type { SessionRepository } from "@system/application/auth/session-repository"
import type { SystemSessionAuditContext } from "@system/application/auth/system-session-audit-context"
import type { SystemSessionMaterialService } from "@system/application/auth/system-session-material-service"

type Props = Readonly<{
  sessionRepository: SessionRepository
  materialService: Pick<SystemSessionMaterialService, "hashRawToken">
}>

export type RevokeSystemSessionCommand = Readonly<{
  rawToken: string
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type RevokeSystemSessionResult = Readonly<{ kind: "completed" }>

/** tokenの実在を外部へ漏らさず、既知Session familyだけを監査付きで冪等失効する。 */
export class RevokeSystemSession {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(command: RevokeSystemSessionCommand): Promise<RevokeSystemSessionResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System Session revocation time is invalid")
    }

    const tokenHash = await this.props.materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const session = await this.props.sessionRepository.findByTokenHash(tokenHash)
    if (session instanceof Error) return session
    if (session === null || session.revokedAt !== null) return RevokeSystemSession.completed()

    const audit = createSystemSessionAudit({
      actorAccountId: session.accountId,
      action: "auth.session.revoke",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit

    const revocationError = await this.props.sessionRepository.revokeFamilyWithAudit({
      familyId: session.familyId,
      revokedAt: command.now,
      audit,
    })

    return revocationError instanceof Error ? revocationError : RevokeSystemSession.completed()
  }

  private static completed(): RevokeSystemSessionResult {
    return Object.freeze({ kind: "completed" as const })
  }
}
