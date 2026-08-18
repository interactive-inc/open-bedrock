import type { AccessTokenView } from "@system/domain/auth/access-token-view"
import { decoySystemPasswordHash } from "@system/infrastructure/auth/decoy-system-password-hash"
import { AuthenticateSystemPassword } from "@system/application/auth/authenticate-system-password"
import { identitySubjectSchema } from "@system/domain/identity/identity-subject"
import { SystemPasswordCredentialRepository } from "@system/infrastructure/auth/system-password-credential-repository"
import { verifyPassword } from "@/lib/auth/verify-password"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { IssueEmployeeSession } from "@/contexts/company-compatibility/application/auth/issue-employee-session"
import { resolveLiveEmployeeAccess } from "@/contexts/company-compatibility/application/auth/resolve-live-employee-access"
import { AccountEmployeeLinkRepository } from "@/contexts/company-compatibility/infrastructure/employee/account-employee-link-repository"

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
 * 認証はSystem Identity bindingを正とし、System AccountとCompany Employeeのlinkを検証する。
 * canonical PBKDF2 credentialだけを受理し、Company Employeeとのlinkを確認する。
 */
export class AuthenticateEmployee {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<AuthenticatedSession | InvalidCredentials | ApplicationError> {
    const subject = identitySubjectSchema.safeParse(command.email.toLowerCase())
    if (!subject.success) {
      await verifyPassword(command.password, decoySystemPasswordHash)
      return { reason: "invalid_credentials" }
    }

    const authentication = await new AuthenticateSystemPassword({
      credentialRepository: new SystemPasswordCredentialRepository({
        database: this.c.var.database,
      }),
      passwordMaterialService: {
        dummyHash: decoySystemPasswordHash,
        needsRehash: () => false,
        verify: (password, passwordHash) => verifyPassword(password, passwordHash),
      },
    }).execute({ subject: subject.data, password: command.password, now: command.now })
    if (authentication instanceof Error) {
      return new UnexpectedError("failed to authenticate identity", { cause: authentication })
    }
    if (authentication.kind === "rejected") {
      return { reason: "invalid_credentials" }
    }

    const accountId = Number(authentication.accountId)
    if (
      !Number.isSafeInteger(accountId) ||
      accountId <= 0 ||
      String(accountId) !== authentication.accountId
    ) {
      return new UnexpectedError("System Account cannot be mapped to the numeric product API")
    }
    const linkedAccount = await new AccountEmployeeLinkRepository(this.c).findLinkedAccount(
      accountId,
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
      accountId,
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
