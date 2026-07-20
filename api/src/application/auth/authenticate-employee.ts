import type { AccessTokenView } from "@/application/auth/access-token-view"
import { createAuditEvent } from "@/domain/audit/audit-event"
import { decoyPasswordHash } from "@/lib/auth/decoy-password-hash"
import { isLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { verifyPassword } from "@/lib/auth/verify-password"
import { isWrappedLegacyHash } from "@/lib/auth/wrap-legacy-hash"
import type { Context } from "@/env"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { RefreshTokenRepository } from "@/infrastructure/auth/refresh-token-repository"
import { resolveLiveEmployeeAccess } from "@/application/auth/resolve-live-employee-access"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"

export type Command = {
  email: string
  password: string
  jwtSecret: string
  userAgent: string | null
  now: Date
}

export type InvalidCredentials = { reason: "invalid_credentials" }

export type AuthenticatedSession = AccessTokenView & {
  accountId: number
  employeeId: number
}

function auditUnavailable(cause: unknown): UnavailableError {
  return new UnavailableError("invalid email or password", "audit_unavailable", { cause })
}

/**
 * メールとパスワードを照合し、成功時にアクセストークンを発行する。
 * 認証は identities(provider=password, subject=正規化email) を正とし、account/employee を検証する。
 * 旧フォーマット（固定ソルト SHA-256）またはラップ済み旧形式は、新フォーマット（PBKDF2）で再ハッシュして書き戻す。
 */
export class AuthenticateEmployee {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AuthenticatedSession | InvalidCredentials | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)

    const tokenSigner = new JoseTokenSigner()

    const identity = await identityRepository.findPasswordIdentityByEmail(command.email)

    if (identity instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identity })
    }

    if (identity === null || identity.secret === null) {
      // ユーザー列挙のタイミング差を消すため、実在ユーザーと同じ PBKDF2 検証コストを払う（#212）。
      await verifyPassword(command.password, decoyPasswordHash)

      return { reason: "invalid_credentials" }
    }

    const isValid = await verifyPassword(command.password, identity.secret)

    if (isValid === false) {
      return { reason: "invalid_credentials" }
    }

    // 停止・ロック中のアカウントは資格情報エラーと同一レスポンスにして状態の漏えいを避ける。
    if (identity.accountStatus !== "active" || identity.employeeId === null) {
      return { reason: "invalid_credentials" }
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, identity.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) {
      return { reason: "invalid_credentials" }
    }

    // 旧形式またはラップ済み旧形式は純正 PBKDF2 に昇格する。
    // 書き戻し失敗はログイン体験を妨げないため握りつぶす（次回ログインで再試行される）。
    if (isLegacyPasswordHash(identity.secret) || isWrappedLegacyHash(identity.secret)) {
      const newHash = await toPasswordHash(command.password)

      await identityRepository.updateSecret(identity.identityId, newHash)
    }

    const accessToken = await tokenSigner.sign(
      {
        accountId: identity.accountId,
        employeeId: identity.employeeId,
        tokenVersion: identity.tokenVersion,
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
          actorAccountId: identity.accountId,
          actorEmployeeId: identity.employeeId,
          action: "auth.session.login_succeeded",
          target: { type: "account", id: String(identity.accountId) },
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
        accountId: identity.accountId,
        tokenHash: hashedToken,
        familyId: crypto.randomUUID(),
        tokenVersion: identity.tokenVersion,
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
      accountId: identity.accountId,
      employeeId: identity.employeeId,
    }
  }
}
