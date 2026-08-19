import { AuthenticateSystemSession } from "@system/application/auth/authenticate-system-session"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { SystemSessionRepository } from "@system/infrastructure/auth/system-session-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

type Props = Readonly<{
  context: SystemD1Context
  jwtSecret: string
  sessionTtlMilliseconds: number
}>

export type SystemSessionApplications = Readonly<{
  issue: IssueSystemSession
  authenticate: AuthenticateSystemSession
  rotate: RotateSystemSession
  revoke: RevokeSystemSession
}>

/** canonical Session lifecycleをSystem内で配線する公開runtime境界。 */
export function createSystemSessionApplications(props: Props): SystemSessionApplications | Error {
  if (!Number.isSafeInteger(props.sessionTtlMilliseconds) || props.sessionTtlMilliseconds <= 0) {
    return new Error("System Session lifetime is invalid")
  }

  const accountRepository = new SystemAccountRepository({ database: props.context.env.DB })
  const sessionRepository = new SystemSessionRepository({ context: props.context })
  const auditAppender = new SystemAuditEventRepository(props.context)
  const materialService = new SystemSessionMaterialService()
  const accessTokenIssuer = new SystemAccessTokenIssuer(props.jwtSecret)

  return Object.freeze({
    issue: new IssueSystemSession({
      accountRepository,
      sessionRepository,
      materialService,
      accessTokenIssuer,
      sessionTtlMilliseconds: props.sessionTtlMilliseconds,
    }),
    authenticate: new AuthenticateSystemSession({
      accountRepository,
      sessionRepository,
      materialService,
    }),
    rotate: new RotateSystemSession({
      accountRepository,
      sessionRepository,
      auditAppender,
      materialService,
      accessTokenIssuer,
      sessionTtlMilliseconds: props.sessionTtlMilliseconds,
    }),
    revoke: new RevokeSystemSession({ sessionRepository, materialService }),
  })
}
