import type { Context } from "@/env"
import { LegacySecretRepository } from "@/infrastructure/system/auth/legacy-secret-repository"
import { isLegacyPasswordHash } from "@/lib/auth/is-legacy-password-hash"
import { wrapLegacyHash } from "@/lib/auth/wrap-legacy-hash"

export type MigrationResult = {
  total: number
  migrated: number
  skipped: number
  failed: number
}

/** System Identity の旧形式 password secret を PBKDF2 ラップ形式に一括移行する。 */
export class MigrateLegacyHashes {
  constructor(private readonly c: Context) {}

  async run(): Promise<MigrationResult | Error> {
    const repository = new LegacySecretRepository(this.c)
    const found = await repository.findPasswordIdentitiesWithNonPbkdf2Secret()

    if (found instanceof Error) {
      return found
    }

    let migrated = 0
    let skipped = 0
    let failed = 0

    for (const identity of found) {
      if (isLegacyPasswordHash(identity.secret) === false) {
        skipped = skipped + 1
        continue
      }

      const wrapped = await wrapLegacyHash(identity.secret)
      const updateResult = await repository.updateSecret(identity.identityId, wrapped)

      if (updateResult instanceof Error) {
        console.error(
          `[migrate-legacy-hashes] failed for identity ${identity.identityId}:`,
          updateResult,
        )
        failed = failed + 1
        continue
      }

      migrated = migrated + 1
    }

    return { total: found.length, migrated, skipped, failed }
  }
}
