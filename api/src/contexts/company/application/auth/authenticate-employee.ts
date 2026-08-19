import type { AccessTokenView } from "@system/domain/auth/access-token-view"
import type { AccountId } from "@system/domain/auth/account-id"
import { AuthenticateSystemPassword } from "@system/application/auth/authenticate-system-password"
import { identitySubjectSchema } from "@system/domain/identity/identity-subject"
import { SystemPasswordCredentialRepository } from "@system/infrastructure/auth/system-password-credential-repository"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { IssueEmployeeSession } from "@/contexts/company/application/auth/issue-employee-session"
import { resolveLiveEmployeeAccess } from "@/contexts/company/application/auth/resolve-live-employee-access"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"

export type Command = {
  email: string
  password: string
  jwtSecret: string
  userAgent: string | null
  now: Date
}

export type InvalidCredentials = { reason: "invalid_credentials" }

export type AuthenticatedSession = AccessTokenView & {
  accountId: AccountId
  employeeId: number
}

const DUMMY_PASSWORD_HASH =
  "pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

/**
 * メールとパスワードを照合し、成功時にアクセストークンを発行する。
 * 認証はSystem Identity bindingを正とし、System AccountとCompany Employeeのlinkを検証する。
 * canonical PBKDF2 credentialだけを受理し、Company Employeeとのlinkを確認する。
 */
export class AuthenticateEmployee {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AuthenticatedSession | InvalidCredentials | ApplicationError> {
    const pepper = this.c.env.PEPPER_SECRET
    if (pepper === undefined || pepper === "") {
      return new UnexpectedError("password authentication is unavailable")
    }

    const subject = identitySubjectSchema.safeParse(command.email.toLowerCase())
    if (!subject.success) {
      await PasswordHashService.verify(command.password, DUMMY_PASSWORD_HASH, pepper)
      return { reason: "invalid_credentials" }
    }

    const authentication = await new AuthenticateSystemPassword({
      credentialRepository: new SystemPasswordCredentialRepository({
        database: this.c.var.database,
      }),
      passwordMaterialService: {
        dummyHash: DUMMY_PASSWORD_HASH,
        needsRehash: (passwordHash) => PasswordHashService.needsRehash(passwordHash),
        verify: async (password, passwordHash) => {
          try {
            return await PasswordHashService.verify(password, passwordHash, pepper)
          } catch (caught) {
            return caught instanceof Error
              ? caught
              : new Error("failed to verify password material")
          }
        },
      },
    }).execute({ subject: subject.data, password: command.password, now: command.now })
    if (authentication instanceof Error) {
      return new UnexpectedError("failed to authenticate identity", { cause: authentication })
    }
    if (authentication.kind === "rejected") {
      return { reason: "invalid_credentials" }
    }

    const linkedAccount = await new AccountEmployeeLinkRepository(this.c).findLinkedAccount(
      authentication.accountId,
    )
    if (linkedAccount instanceof Error) {
      return new UnexpectedError("failed to find employee link", { cause: linkedAccount })
    }
    if (linkedAccount?.employeeId === null || linkedAccount === null) {
      return { reason: "invalid_credentials" }
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, linkedAccount.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) {
      return { reason: "invalid_credentials" }
    }

    const issued = await new IssueEmployeeSession(this.c).run({
      accountId: authentication.accountId,
      employeeId: linkedAccount.employeeId,
      tokenVersion: authentication.tokenVersion,
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
