import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"
import type { IdentityId } from "@system/domain/identity/identity-id"
import type { IdentitySubject } from "@system/domain/identity/identity-subject"
import type { RoleBindingId } from "@system/domain/iam/role-binding.entity"

export type SystemRootBootstrapWrite = Readonly<{
  accountId: AccountId
  identityId: IdentityId
  identitySubject: IdentitySubject
  email: string
  passwordHash: string
  rootBindingId: RoleBindingId
  occurredAt: Date
  auditEvent: SystemAuditEvent<AccountId>
}>

export type SystemRootBootstrapRepositoryResult =
  | Readonly<{
      kind: "created"
      accountId: AccountId
      identityId: IdentityId
      rootBindingId: RoleBindingId
      email: string
    }>
  | Readonly<{
      kind: "already_initialized"
      accountId: AccountId | null
      identityId: IdentityId | null
      rootBindingId: RoleBindingId | null
      email: string | null
      state: "complete" | "account_exists_without_bootstrap_state"
    }>

/** Systemだけで完結するsingle-use root bootstrapのApplication port。 */
export type SystemRootBootstrapRepository = Readonly<{
  bootstrap: (
    write: SystemRootBootstrapWrite,
  ) => Promise<SystemRootBootstrapRepositoryResult | Error>
}>
