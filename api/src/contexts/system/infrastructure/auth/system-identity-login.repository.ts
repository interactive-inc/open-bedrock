import { Account } from "@system/domain/auth/account.entity"
import type { IdentityProvider } from "@system/domain/identity/identity-provider"
import { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import type { IdentitySubject } from "@system/domain/identity/identity-subject"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

type Row = Readonly<{
  account_id: unknown
  account_status: unknown
  account_token_version: unknown
  account_created_at: unknown
  account_updated_at: unknown
  identity_id: unknown
  identity_provider: unknown
  identity_subject: unknown
  identity_created_at: unknown
  identity_activated_at: unknown
  identity_revoked_at: unknown
}>

export type SystemIdentityLogin = Readonly<{
  account: Account
  identity: IdentityBinding
}>

/** activeなIdentity bindingとSystem Accountだけを一つのlogin snapshotとして読む。 */
export class SystemIdentityLoginRepository {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async find(
    provider: IdentityProvider,
    subject: IdentitySubject,
  ): Promise<SystemIdentityLogin | null | Error> {
    try {
      const row = await this.context.env.DB.prepare(
        `SELECT account.id AS account_id, account.status AS account_status,
                account.token_version AS account_token_version,
                account.created_at AS account_created_at, account.updated_at AS account_updated_at,
                identity.id AS identity_id, identity.provider AS identity_provider,
                identity.subject AS identity_subject, identity.created_at AS identity_created_at,
                identity.activated_at AS identity_activated_at,
                identity.revoked_at AS identity_revoked_at
         FROM system_identity_bindings identity
         INNER JOIN system_accounts account ON account.id = identity.account_id
         WHERE identity.provider = ?1 AND identity.subject = ?2
           AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
         LIMIT 1`,
      )
        .bind(provider, subject)
        .first<Row>()
      if (row === null) return null

      const account = Account.create({
        id: row.account_id,
        status: row.account_status,
        tokenVersion: row.account_token_version,
        createdAt:
          typeof row.account_created_at === "number"
            ? new Date(row.account_created_at)
            : row.account_created_at,
        updatedAt:
          typeof row.account_updated_at === "number"
            ? new Date(row.account_updated_at)
            : row.account_updated_at,
      })
      if (account instanceof Error) return account
      const identity = IdentityBinding.create({
        id: row.identity_id,
        accountId: row.account_id,
        provider: row.identity_provider,
        subject: row.identity_subject,
        createdAt:
          typeof row.identity_created_at === "number"
            ? new Date(row.identity_created_at)
            : row.identity_created_at,
        activatedAt:
          typeof row.identity_activated_at === "number"
            ? new Date(row.identity_activated_at)
            : row.identity_activated_at,
        revokedAt:
          typeof row.identity_revoked_at === "number"
            ? new Date(row.identity_revoked_at)
            : row.identity_revoked_at,
      })
      if (identity instanceof Error) return identity

      return Object.freeze({ account, identity })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System Identity login")
    }
  }
}
