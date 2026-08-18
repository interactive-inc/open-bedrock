import { createAuditEvent } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import { identitySubjectSchema } from "@/contexts/system/domain/identity/identity-subject"
import type { Context } from "@/env"
import { BootstrapAccountRepository } from "@/contexts/company-compatibility/infrastructure/iam/bootstrap-account-repository"
import type { AlreadyInitialized } from "@/contexts/company-compatibility/infrastructure/iam/bootstrap-account-repository"
import { validatePasswordComplexity } from "@/contexts/company-compatibility/application/auth/password-policy"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

export type Command = {
  email: string
  password: string
  name: string
  code: string
  now: Date
}

export type BootstrapResult = {
  accountId: number
  employeeId: number
  email: string
}

/**
 * 初期 ROOT アカウントを作成する。BOOTSTRAP_TOKEN の検証と一回性ゲートは interface 層と
 * リポジトリの原子的バッチが担い、ここでは入力の正規化・ハッシュ化・監査イベントの組み立てを行う。
 * system_bootstrap_state が確定済みの場合は AlreadyInitialized を返し、二重初期化を拒否する。
 */
export class BootstrapInitialAccount {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BootstrapResult | AlreadyInitialized | ApplicationError> {
    const passwordError = validatePasswordComplexity(command.password)

    if (passwordError !== null) {
      return passwordError
    }

    const normalizedEmail = command.email.trim().toLowerCase()
    const subject = identitySubjectSchema.safeParse(normalizedEmail)

    if (!subject.success) {
      return new UnexpectedError("invalid bootstrap identity subject", { cause: subject.error })
    }

    const secret = await toPasswordHash(command.password)

    let identifierHash: string
    try {
      identifierHash = await hashAuditIdentifier(command.email, this.c.env.AUDIT_HMAC_SECRET)
    } catch (cause) {
      return new UnexpectedError("failed to hash audit identifier", { cause })
    }

    let audit
    try {
      audit = createAuditEvent(
        {
          actorAccountId: null,
          actorEmployeeId: null,
          action: "auth.bootstrap.completed",
          target: { type: "account", id: null },
          outcome: "succeeded",
          reasonCode: null,
          metadata: { identifier_hash: identifierHash },
          now: command.now,
        },
        this.c.var.auditContext,
      )
    } catch (cause) {
      return new UnexpectedError("failed to build bootstrap audit event", { cause })
    }

    const created = await new BootstrapAccountRepository(this.c).createRootAccount({
      code: command.code,
      name: command.name,
      email: command.email,
      subject: subject.data,
      secret,
      now: command.now.getTime(),
      audit,
    })

    if ("reason" in created) {
      return created
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to bootstrap root account", { cause: created })
    }

    return {
      accountId: created.accountId,
      employeeId: created.employeeId,
      email: normalizedEmail,
    }
  }
}
