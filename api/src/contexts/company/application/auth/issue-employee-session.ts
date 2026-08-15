import type { AccessTokenView } from "@/contexts/company/application/system-compatibility/auth/access-token-view"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type { Context } from "@/env"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { JoseTokenSigner } from "@/contexts/company/infrastructure/auth/jose-token-signer"
import { RefreshTokenRepository } from "@/contexts/company/infrastructure/auth/refresh-token-repository"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { generateOpaqueToken } from "@/contexts/system/infrastructure/auth/generate-opaque-token"

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

    const canonicalSession = await resolveAccountSession({
      accountRepository: new SystemAccountRepository({ database: this.c.env.DB }),
      accountId: accountId.data,
      sessionTokenVersion: command.tokenVersion,
    })

    if (canonicalSession instanceof Error) {
      return new UnexpectedError("failed to authorize account session", {
        cause: canonicalSession,
      })
    }

    if (canonicalSession.kind === "rejected") {
      return { reason: "account_session_rejected" }
    }

    const canonicalTokenVersion = canonicalSession.account.tokenVersion
    const tokenSigner = new JoseTokenSigner()

    const accessToken = await tokenSigner.sign(
      {
        accountId: command.accountId,
        tokenVersion: canonicalTokenVersion,
      },
      command.jwtSecret,
    )

    if (accessToken instanceof Error) {
      return new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    const rawRefreshToken = generateOpaqueToken()

    const hashedToken = await refreshTokenHash(rawRefreshToken)

    const nowEpoch = Math.floor(command.now.getTime() / 1_000)

    let auditStatements: ReturnType<SystemAuditEventRepository["prepareAppend"]>
    try {
      const metadataJson = toStableSystemAuditJson({
        client_ip: this.c.var.auditContext.clientIp,
        client_name: this.c.var.auditContext.clientName,
        request_id: this.c.var.auditContext.requestId,
      })
      if (metadataJson instanceof Error) return auditUnavailable(metadataJson)

      const auditRecord = createSystemAuditEvent({
        actorAccountId: String(command.accountId),
        action: command.successAction,
        targetType: "account",
        targetId: String(command.accountId),
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson,
        occurredAt: command.now,
      })
      if (auditRecord instanceof Error) return auditUnavailable(auditRecord)
      auditStatements = new SystemAuditEventRepository(this.c).prepareAppend(auditRecord)
    } catch (cause) {
      return auditUnavailable(cause)
    }

    const createResult = await new RefreshTokenRepository(this.c).createWithAudit(
      {
        accountId: command.accountId,
        tokenHash: hashedToken,
        familyId: crypto.randomUUID(),
        tokenVersion: canonicalTokenVersion,
        userAgent: command.userAgent,
        nowEpoch,
      },
      auditStatements,
    )

    if (createResult instanceof Error) {
      return auditUnavailable(createResult)
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      accountId: command.accountId,
      employeeId: command.employeeId,
    }
  }
}
