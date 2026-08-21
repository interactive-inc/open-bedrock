import type { SystemPasswordHasher } from "@system/infrastructure/auth/system-password-hasher.repository"
import type {
  SystemRootBootstrapRepository,
  SystemRootBootstrapRepositoryResult,
} from "@system/infrastructure/iam/system-root-bootstrap-port.repository"
import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { EmailValue } from "@system/domain/auth/email.value"
import {
  validateSystemPassword,
  type SystemPasswordPolicyViolation,
} from "@system/domain/auth/system-password-policy"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { zIdentityId } from "@system/domain/identity/identity-id"
import { identitySubjectSchema } from "@system/domain/identity/identity-subject"
import { roleBindingIdSchema } from "@system/domain/iam/role-binding.entity"
import { z } from "zod"

const bootstrapEmailSchema = EmailValue.schema.pipe(z.string().max(254)).pipe(identitySubjectSchema)

type Props = Readonly<{
  passwordHasher: SystemPasswordHasher
  repository: SystemRootBootstrapRepository
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
      reason: "invalid_email" | "invalid_time" | SystemPasswordPolicyViolation
    }>

/** Account・Identity・credential・root binding・監査をCompanyなしで初期化する。 */
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

    const passwordViolation = validateSystemPassword(command.password)
    if (passwordViolation !== null) {
      return Object.freeze({ kind: "invalid_input" as const, reason: passwordViolation })
    }

    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const rootBindingId = roleBindingIdSchema.safeParse(crypto.randomUUID())
    if (!accountId.success || !identityId.success || !rootBindingId.success) {
      return new Error("failed to generate System bootstrap identifiers")
    }

    let passwordHash: string | Error
    try {
      passwordHash = await this.props.passwordHasher.hash(command.password)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to hash System password")
    }
    if (passwordHash instanceof Error) return passwordHash

    const auditEvent = createSystemAuditEvent<AccountId>({
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
