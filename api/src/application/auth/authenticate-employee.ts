import type { AccessTokenView } from "@/application/auth/access-token-view"
import { decoyPasswordHash } from "@/domain/auth/decoy-password-hash"
import { isLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { toPasswordHash } from "@/domain/auth/to-password-hash"
import { verifyPassword } from "@/domain/auth/verify-password"
import { isWrappedLegacyHash } from "@/domain/auth/wrap-legacy-hash"
import type { Context } from "@/env"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  email: string
  password: string
  jwtSecret: string
}

export type InvalidCredentials = { reason: "invalid_credentials" }

// メールとパスワードを照合し、成功時にアクセストークンを発行する。
// 旧フォーマット（固定ソルト SHA-256）またはラップ済み旧形式（pbkdf2-wrapped-legacy）で
// 認証成功した場合は、新フォーマット（PBKDF2）で再ハッシュして書き戻す。
export class AuthenticateEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AccessTokenView | InvalidCredentials | Error> {
    const employeeRepository = new EmployeeRepository(this.c)

    const tokenSigner = new JoseTokenSigner()

    const found = await employeeRepository.findByEmail(command.email)

    if (found instanceof Error) {
      return found
    }

    if (found === null) {
      // ユーザー列挙のタイミング差を消すため、実在ユーザーと同じ PBKDF2 検証コストを払う（#212）。
      await verifyPassword(command.password, decoyPasswordHash)

      return { reason: "invalid_credentials" }
    }

    const isValid = await verifyPassword(command.password, found.passwordHash)

    if (isValid === false) {
      return { reason: "invalid_credentials" }
    }

    // 旧形式またはラップ済み旧形式は純正 PBKDF2 に昇格する。
    // 書き戻し失敗はログイン体験を妨げないため握りつぶす（次回ログインで再試行される）。
    if (isLegacyPasswordHash(found.passwordHash) || isWrappedLegacyHash(found.passwordHash)) {
      const newHash = await toPasswordHash(command.password)

      await employeeRepository.updatePasswordHash(found.id, newHash)
    }

    const accessToken = await tokenSigner.sign(
      { employeeId: found.id, email: found.email, role: found.role },
      command.jwtSecret,
    )

    if (accessToken instanceof Error) {
      return accessToken
    }

    return { accessToken }
  }
}
