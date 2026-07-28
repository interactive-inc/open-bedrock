import type { AccessTokenView } from "@/application/auth/access-token-view"
import type { AuditAction } from "@/domain/audit/audit-event"
import { createAuditEvent } from "@/domain/audit/audit-event"
import type { Context } from "@/env"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { RefreshTokenRepository } from "@/infrastructure/auth/refresh-token-repository"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"

export type IssueSessionCommand = {
  accountId: number
  employeeId: number
  tokenVersion: number
  jwtSecret: string
  userAgent: string | null
  now: Date
  /** 成功時に記録する監査アクション（password ログインと外部 identity ログインで異なる）。 */
  successAction: AuditAction
}

export type IssuedSession = AccessTokenView & {
  accountId: number
  employeeId: number
}

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

  async run(command: IssueSessionCommand): Promise<IssuedSession | ApplicationError> {
    const tokenSigner = new JoseTokenSigner()

    const accessToken = await tokenSigner.sign(
      {
        accountId: command.accountId,
        employeeId: command.employeeId,
        tokenVersion: command.tokenVersion,
      },
      command.jwtSecret,
    )

    if (accessToken instanceof Error) {
      return new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    const rawRefreshToken = crypto.randomUUID()

    const hashedToken = await refreshTokenHash(rawRefreshToken)

    const nowEpoch = Math.floor(command.now.getTime() / 1_000)

    let auditStatements: ReturnType<AuditEventRepository["prepareAppend"]>
    try {
      const auditRecord = createAuditEvent(
        {
          actorAccountId: command.accountId,
          actorEmployeeId: command.employeeId,
          action: command.successAction,
          target: { type: "account", id: String(command.accountId) },
          outcome: "succeeded",
          reasonCode: null,
          now: command.now,
        },
        this.c.var.auditContext,
      )
      auditStatements = new AuditEventRepository(this.c).prepareAppend(auditRecord)
    } catch (cause) {
      return auditUnavailable(cause)
    }

    const createResult = await new RefreshTokenRepository(this.c).createWithAudit(
      {
        accountId: command.accountId,
        tokenHash: hashedToken,
        familyId: crypto.randomUUID(),
        tokenVersion: command.tokenVersion,
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
