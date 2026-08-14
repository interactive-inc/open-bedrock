import { AuthenticateSystemSession } from "@system/application/auth/authenticate-system-session"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { SystemSessionRepository } from "@system/infrastructure/auth/system-session-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

type Props = Readonly<{
  context: SystemD1Context
  sessionTtlMilliseconds: number
}>

export type SystemSessionApplications = Readonly<{
  issue: IssueSystemSession
  authenticate: AuthenticateSystemSession
  rotate: RotateSystemSession
  revoke: RevokeSystemSession
}>

/** canonical Session lifecycleのApplicationとD1 adapterを欠落なく配線する共通composition。 */
export function createSystemSessionApplications(props: Props): SystemSessionApplications | Error {
  if (!Number.isSafeInteger(props.sessionTtlMilliseconds) || props.sessionTtlMilliseconds <= 0) {
    return new Error("System Session lifetime is invalid")
  }

  const accountRepository = new SystemAccountRepository({ database: props.context.env.DB })
  const sessionRepository = new SystemSessionRepository({ context: props.context })
  const auditAppender = new SystemAuditEventRepository(props.context)
  const materialService = new SystemSessionMaterialService()

  return Object.freeze({
    issue: new IssueSystemSession({
      accountRepository,
      sessionRepository,
      materialService,
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
      sessionTtlMilliseconds: props.sessionTtlMilliseconds,
    }),
    revoke: new RevokeSystemSession({ sessionRepository, materialService }),
  })
}
