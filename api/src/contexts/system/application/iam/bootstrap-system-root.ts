import type { InvalidSystemPasswordReason } from "@system/domain/errors"
import { zAccountId, type AccountId } from "@system/domain/values/account-id.schema"
import { EmailValue } from "@system/domain/values/email.value"
import { SystemPasswordValue } from "@system/domain/values/system-password.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zIdentityId } from "@system/domain/values/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/values/identity-subject.schema"
import { roleBindingIdSchema } from "@system/domain/values/role-binding.schema"
import type {
  SystemRootBootstrapRepositoryD1,
  SystemRootBootstrapRepositoryResult,
} from "@system/infrastructure/iam/system-root-bootstrap.repository"
import { z } from "zod"

const bootstrapEmailSchema = EmailValue.schema.pipe(z.string().max(254)).pipe(identitySubjectSchema)

export type SystemPasswordHasher = Readonly<{
  hash: (password: string) => Promise<string | Error>
}>

type Props = Readonly<{
  passwordHasher: SystemPasswordHasher
  repository: Pick<SystemRootBootstrapRepositoryD1, "bootstrap">
}>

export type BootstrapSystemRootCommand = Readonly<{
  email: string
  password: string
  now: Date
}>

export type BootstrapSystemRootResult =
  | SystemRootBootstrapRepositoryResult
  | Readonly<{
      kind: "invalid_input"
      reason: "invalid_email" | "invalid_time" | InvalidSystemPasswordReason
    }>

/** AccountEntity・Identity・credential・root binding・監査をCompanyなしで初期化する。 */
export class BootstrapSystemRoot {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(command: BootstrapSystemRootCommand): Promise<BootstrapSystemRootResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return Object.freeze({ kind: "invalid_input" as const, reason: "invalid_time" as const })
    }

    const email = bootstrapEmailSchema.safeParse(command.email)
    if (!email.success) {
      return Object.freeze({ kind: "invalid_input" as const, reason: "invalid_email" as const })
    }

    const password = SystemPasswordValue.create(command.password)
    if (!(password instanceof SystemPasswordValue)) {
      return Object.freeze({ kind: "invalid_input" as const, reason: password.reason })
    }

    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const rootBindingId = roleBindingIdSchema.safeParse(crypto.randomUUID())
    if (!accountId.success || !identityId.success || !rootBindingId.success) {
      return new Error("failed to generate System bootstrap identifiers")
    }

    let passwordHash: string | Error
    try {
      passwordHash = await this.props.passwordHasher.hash(password.toString())
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to hash System password")
    }
    if (passwordHash instanceof Error) return passwordHash

    const auditEvent = SystemAuditEventEntity.create<AccountId>({
      actorAccountId: null,
      action: "system.bootstrap.completed",
      targetType: "system_account",
      targetId: accountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: command.now,
    })
    if (auditEvent instanceof Error) return auditEvent

    return this.props.repository.bootstrap({
      accountId: accountId.data,
      identityId: identityId.data,
      identitySubject: email.data,
      email: email.data,
      passwordHash,
      rootBindingId: rootBindingId.data,
      occurredAt: command.now,
      auditEvent,
    })
  }
}
