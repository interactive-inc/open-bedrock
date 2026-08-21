import type { AccountId } from "@system/domain/values/account-id.schema"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context.repository"
import type { OidcIdentity } from "@system/infrastructure/identity/oidc-id-token.service.repository"
import {
  systemAccounts,
  systemIdentityBindings,
  systemIdentityProfiles,
} from "@system/infrastructure/schema/system-core"
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm"

/** active Accountと有効なIdentity profileからOIDC claimを解決する。 */
export class SystemOidcIdentityRepository {
  constructor(private readonly context: SystemDatabaseContext) {
    Object.freeze(this)
  }

  async findByAccountId(accountId: AccountId): Promise<OidcIdentity | null | Error> {
    try {
      const rows = await this.context.var.database
        .select({
          accountId: systemAccounts.id,
          accountStatus: systemAccounts.status,
          email: systemIdentityProfiles.email,
          emailVerified: systemIdentityProfiles.emailVerified,
        })
        .from(systemAccounts)
        .leftJoin(
          systemIdentityBindings,
          and(
            eq(systemIdentityBindings.accountId, systemAccounts.id),
            isNotNull(systemIdentityBindings.activatedAt),
            isNull(systemIdentityBindings.revokedAt),
          ),
        )
        .leftJoin(
          systemIdentityProfiles,
          eq(systemIdentityProfiles.identityId, systemIdentityBindings.id),
        )
        .where(eq(systemAccounts.id, accountId))
        .orderBy(
          desc(systemIdentityProfiles.emailVerified),
          desc(systemIdentityProfiles.lastUsedAt),
          asc(systemIdentityBindings.createdAt),
        )
        .limit(1)
      const row = rows.at(0)

      if (row === undefined || row.accountStatus !== "active") return null

      return Object.freeze({
        subject: row.accountId,
        email: row.email,
        emailVerified: row.emailVerified ?? false,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve OIDC identity")
    }
  }
}
