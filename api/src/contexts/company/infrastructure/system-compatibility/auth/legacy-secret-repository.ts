import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { identities } from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
import { and, eq, isNotNull, like, not } from "drizzle-orm"

export type LegacySecretIdentity = Readonly<{
  identityId: number
  secret: string
}>

/** System Identity の旧 secret 形式だけを扱う、移行バッチ用の狭い repository。 */
export class LegacySecretRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async findPasswordIdentitiesWithNonPbkdf2Secret(): Promise<
    ReadonlyArray<LegacySecretIdentity> | Error
  > {
    try {
      const rows = await this.c.var.database
        .select({ id: identities.id, secret: identities.secret })
        .from(identities)
        .where(
          and(
            eq(identities.provider, "password"),
            isNotNull(identities.secret),
            not(like(identities.secret, "pbkdf2:%")),
          ),
        )

      return rows
        .filter((row): row is { id: number; secret: string } => row.secret !== null)
        .map((row) => ({ identityId: row.id, secret: row.secret }))
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to load identities with legacy secret")
    }
  }

  async updateSecret(identityId: number, secret: string): Promise<null | Error> {
    try {
      await this.c.var.database
        .update(identities)
        .set({ secret })
        .where(eq(identities.id, identityId))

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update identity secret")
    }
  }
}
