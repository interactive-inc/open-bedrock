import type { AccessTokenView } from "@/application/auth/access-token-view"
import { isLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { toPasswordHash } from "@/domain/auth/to-password-hash"
import { verifyPassword } from "@/domain/auth/verify-password"
import type { Context } from "@/env"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  email: string
  password: string
  jwtSecret: string
}

export type InvalidCredentials = { reason: "invalid_credentials" }

/**
 * メールとパスワードを照合し、成功時にアクセストークンを発行する。
 * 旧フォーマット（固定ソルト SHA-256）で認証成功した場合は、新フォーマット（PBKDF2）で再ハッシュして書き戻す。
 */
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
      return { reason: "invalid_credentials" }
    }

    const isValid = await verifyPassword(command.password, found.passwordHash)

    if (isValid === false) {
      return { reason: "invalid_credentials" }
    }

    if (isLegacyPasswordHash(found.passwordHash)) {
      const newHash = await toPasswordHash(command.password)

      // 書き戻し失敗はログイン体験を妨げないため握りつぶす（次回ログインで再試行される）。
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
