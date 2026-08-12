import type { AccessTokenView } from "@/application/auth/access-token-view"
import { IssueEmployeeSession } from "@/application/auth/issue-employee-session"
import { resolveLiveEmployeeAccess } from "@/application/auth/resolve-live-employee-access"
import type { Context } from "@/env"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { ApplicationError, NotFoundError, UnexpectedError } from "@/lib/errors"

/** 外部 identity provider は OIDC ブローカー。identity の provider 値に対応する。 */
const EXTERNAL_PROVIDER = "oidc" as const

export type IdentityLoginCommand = {
  /** 検証済み外部トークンの sub。identity の subject に対応する。 */
  subject: string
  jwtSecret: string
  userAgent: string | null
  now: Date
}

export type AuthenticatedSession = AccessTokenView & {
  accountId: number
  employeeId: number
}

/** アカウントは存在するが停止・失効等でログインさせない。 */
export type IdentityLoginDenied = { reason: "account_inactive" }

/**
 * 検証済みの外部 identity(sub)に対応するアカウントへアクセストークンを発行する。
 *
 * アカウントが無ければ NotFoundError("account_not_found") を返す（ログイン時の自動作成はしない）。
 * account が active でない・従業員が在籍でない場合は account_inactive として拒否する。
 * トークン発行は password ログインと同じ IssueEmployeeSession を再利用する（照合だけを外した経路）。
 */
export class AuthenticateIdentity {
  constructor(private readonly c: Context) {}

  async run(
    command: IdentityLoginCommand,
  ): Promise<AuthenticatedSession | IdentityLoginDenied | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)

    const identity = await identityRepository.findByProviderSubject(
      EXTERNAL_PROVIDER,
      command.subject,
    )

    if (identity instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identity })
    }

    if (identity === null || identity.employeeId === null) {
      return new NotFoundError("account not found", "account_not_found")
    }

    if (identity.accountStatus !== "active") {
      return { reason: "account_inactive" }
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, identity.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) {
      return { reason: "account_inactive" }
    }

    const issued = await new IssueEmployeeSession(this.c).run({
      accountId: identity.accountId,
      employeeId: identity.employeeId,
      tokenVersion: identity.tokenVersion,
      jwtSecret: command.jwtSecret,
      userAgent: command.userAgent,
      now: command.now,
      successAction: "auth.session.identity_login_succeeded",
    })

    return !(issued instanceof Error) && "reason" in issued
      ? { reason: "account_inactive" }
      : issued
  }
}
