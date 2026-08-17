import type { AccessTokenView } from "@/api/legacy-system/use-cases/auth/access-token-view"
import { decoyPasswordHash } from "@/api/legacy-system/use-cases/auth/decoy-password-hash"
import { isLegacyPasswordHash } from "@/lib/auth/is-legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { verifyPassword } from "@/lib/auth/verify-password"
import { isWrappedLegacyHash } from "@/lib/auth/is-wrapped-legacy-hash"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { IssueEmployeeSession } from "@/contexts/company-compatibility/application/auth/issue-employee-session"
import { resolveLiveEmployeeAccess } from "@/contexts/company-compatibility/application/auth/resolve-live-employee-access"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"

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

    const issued = await new IssueEmployeeSession(this.c).run({
      accountId: identity.accountId,
      employeeId: identity.employeeId,
      tokenVersion: identity.tokenVersion,
      jwtSecret: command.jwtSecret,
      userAgent: command.userAgent,
      now: command.now,
      successAction: "auth.session.login_succeeded",
    })

    return !(issued instanceof Error) && "reason" in issued
      ? { reason: "invalid_credentials" }
      : issued
  }
}
