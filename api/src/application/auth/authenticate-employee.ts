import type { AccessTokenView } from "@/application/auth/access-token-view"
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
