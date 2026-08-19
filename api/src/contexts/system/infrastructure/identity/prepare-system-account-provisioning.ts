import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type { IamRoleId } from "@system/domain/iam/iam-role.entity"
import type { IdentityProvider } from "@system/domain/identity/identity-provider"
import { zIdentityId } from "@system/domain/identity/identity-id"
import { identitySubjectSchema } from "@system/domain/identity/identity-subject"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

export type PreparedSystemAccountProvisioning = Readonly<{
  accountId: AccountId
  accountStatement: D1PreparedStatement
  identityStatements: ReadonlyArray<D1PreparedStatement>
}>

/** 新規Account・Identity・Role Bindingを一つのSystem変更単位として準備する。 */
export class PrepareSystemAccountProvisioning {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  prepare(input: {
    actorAccountId: AccountId | null
    provider: IdentityProvider
    subject: string
    email: string
    passwordHash: string | null
    roleId: IamRoleId
    now: Date
  }): PreparedSystemAccountProvisioning | Error {
    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!accountId.success || !identityId.success || !subject.success) {
      return new Error("invalid System provisioning identity")
    }
    if (
      !Number.isSafeInteger(input.now.getTime()) ||
      (input.provider === "password") !== (input.passwordHash !== null)
    ) {
      return new Error("invalid System provisioning input")
    }
    const afterJson = toStableSystemAuditJson({
      identity_id: identityId.data,
      identity_provider: input.provider,
      role_id: input.roleId,
      status: "active",
    })
    if (afterJson instanceof Error) return afterJson
    const auditEvent = createSystemAuditEvent({
      actorAccountId: input.actorAccountId,
      action: "system.account.provisioned",
      targetType: "system:account",
      targetId: accountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson,
      metadataJson: null,
      occurredAt: input.now,
    })
    if (auditEvent instanceof Error) return auditEvent

    const database = this.context.env.DB
    const accountStatement = database
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .bind(accountId.data, input.now.getTime())
    const identityStatements = [
      database
        .prepare(
          `WITH actor_permissions AS (
             SELECT DISTINCT permission.permission_key AS key
             FROM system_accounts account
             INNER JOIN system_role_bindings binding ON binding.account_id = account.id
             INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
             WHERE account.id = ?1 AND account.status = 'active'
               AND binding.resource_type IS NULL AND binding.revoked_at IS NULL
           ), target_permissions AS (
             SELECT permission_key AS key FROM system_iam_role_permissions WHERE role_id = ?2
           )
           SELECT CASE WHEN ?1 IS NULL
             OR EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
             OR (
               EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
               AND NOT EXISTS (
                 SELECT 1 FROM target_permissions target
                 WHERE NOT EXISTS (
                   SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
                 )
               )
             )
           THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
        )
        .bind(input.actorAccountId, input.roleId),
      database
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`,
        )
        .bind(identityId.data, accountId.data, input.provider, subject.data, input.now.getTime()),
      database
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 1, NULL, ?3)`,
        )
        .bind(identityId.data, input.email, input.now.getTime()),
      ...(input.passwordHash === null
        ? []
        : [
            database
              .prepare(
                `INSERT INTO system_password_credentials
                   (identity_id, password_hash, changed_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?3, ?3)`,
              )
              .bind(identityId.data, input.passwordHash, input.now.getTime()),
          ]),
      database
        .prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`,
        )
        .bind(crypto.randomUUID(), accountId.data, input.roleId, input.now.getTime()),
      ...new SystemAuditEventRepository(this.context).prepareAppend(auditEvent),
    ]

    return Object.freeze({
      accountId: accountId.data,
      accountStatement,
      identityStatements: Object.freeze(identityStatements),
    })
  }
}
