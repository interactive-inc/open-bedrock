import type { AccessTokenView } from "@system/domain/auth/access-token-view"
import { zAccountId } from "@system/domain/auth/account-id"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type { Context } from "@/env"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { JoseTokenSigner } from "@/contexts/company-compatibility/infrastructure/auth/jose-token-signer"
import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"

export type IssueSessionCommand = {
  accountId: number
  employeeId: number
  tokenVersion: number
  jwtSecret: string
  userAgent: string | null
  now: Date
  /** 成功時に記録する監査アクション（password ログインと外部 identity ログインで異なる）。 */
  successAction:
    | "auth.session.login_succeeded"
    | "auth.session.identity_login_succeeded"
    | "auth.session.cli_login_succeeded"
    | "auth.session.browser_login_succeeded"
}

export type IssuedSession = AccessTokenView & {
  accountId: number
  employeeId: number
}

export type SessionIssuanceRejected = { reason: "account_session_rejected" }

function auditUnavailable(cause: unknown): UnavailableError {
  return new UnavailableError("invalid email or password", "audit_unavailable", { cause })
}

/**
 * 認証手段を問わず、確定済みのアカウントに対してアクセストークンとリフレッシュトークンを発行する。
 * 監査記録とリフレッシュトークン作成を単一 transaction 境界で束ね、片方だけ残る状態を防ぐ。
 * password 照合や外部トークン検証は呼び出し側の責務で、ここは発行のみを担う。
 */
export class IssueEmployeeSession {
  constructor(private readonly c: Context) {}

  async run(
    command: IssueSessionCommand,
  ): Promise<IssuedSession | SessionIssuanceRejected | ApplicationError> {
    const accountId = zAccountId.safeParse(String(command.accountId))

    if (accountId.success === false) {
      return new UnexpectedError("failed to authorize account session")
    }

    const applications = createSystemSessionApplications({
      context: { env: { DB: this.c.env.DB } },
      sessionTtlMilliseconds: 7 * 24 * 60 * 60 * 1_000,
    })
    if (applications instanceof Error) {
      return new UnexpectedError("failed to configure account session", { cause: applications })
    }

    const metadataJson = toStableSystemAuditJson({
      client_ip: this.c.var.auditContext.clientIp,
      client_name: this.c.var.auditContext.clientName,
      request_id: this.c.var.auditContext.requestId,
      transport_action: command.successAction,
    })
    if (metadataJson instanceof Error) return auditUnavailable(metadataJson)

    const issued = await applications.issue.execute({
      accountId: accountId.data,
      tokenVersion: command.tokenVersion,
      now: command.now,
      auditContext: { authorizationJson: null, metadataJson },
    })
    if (issued instanceof Error) return auditUnavailable(issued)
    if (issued.kind === "rejected") return { reason: "account_session_rejected" }

    const accessToken = await new JoseTokenSigner().sign(
      { accountId: command.accountId, tokenVersion: issued.tokenVersion },
      command.jwtSecret,
    )
    if (accessToken instanceof Error) {
      await applications.revoke.execute({
        rawToken: issued.rawToken,
        now: command.now,
        auditContext: { authorizationJson: null, metadataJson },
      })
      return new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    return {
      accessToken,
      refreshToken: issued.rawToken,
      accountId: command.accountId,
      employeeId: command.employeeId,
    }
  }
}
