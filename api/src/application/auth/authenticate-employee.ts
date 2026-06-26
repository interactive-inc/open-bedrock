import type { AccessTokenView } from "@/application/auth/access-token-view"
import { decoyPasswordHash } from "@/lib/auth/decoy-password-hash"
import { isLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { verifyPassword } from "@/lib/auth/verify-password"
import { isWrappedLegacyHash } from "@/lib/auth/wrap-legacy-hash"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"

export type Command = {
  email: string
  password: string
  jwtSecret: string
}

export type InvalidCredentials = { reason: "invalid_credentials" }

// メールとパスワードを照合し、成功時にアクセストークンを発行する。
// 認証は identities(provider=password, subject=正規化email) を正とし、account/employee を検証する。
// 旧フォーマット（固定ソルト SHA-256）またはラップ済み旧形式は、新フォーマット（PBKDF2）で再ハッシュして書き戻す。
export class AuthenticateEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AccessTokenView | InvalidCredentials | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)

    const employeeRepository = new EmployeeRepository(this.c)

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

    const employee = await employeeRepository.findById(identity.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    // NOTE: 休職中（leave）のログイン可否は仕様確認待ち（#775）。現状は許可。
    // 退職者はログイン不可。資格情報エラーと同一レスポンスにして在籍状態の漏えいを避ける。
    if (employee === null || employee.status === "retired") {
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

    return { accessToken }
  }
}
