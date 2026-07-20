import { isLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { wrapLegacyHash } from "@/lib/auth/wrap-legacy-hash"
import type { Context } from "@/env"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"

export type MigrationResult = {
  total: number
  migrated: number
  skipped: number
  failed: number
}

/**
 * 旧形式ハッシュ（固定ソルト SHA-256）を PBKDF2 ラップ形式に一括移行する。
 * ユーザーの平文パスワード不要で実行できる hash-of-hash 方式。
 * 認証情報は identities.secret が正で、その password identity を対象にする。
 * 次回ログイン時に authenticate-employee が純正 PBKDF2 へ昇格する
 */
export class MigrateLegacyHashes {
  constructor(private readonly c: Context) {}

  async run(): Promise<MigrationResult | Error> {
    const repository = new IdentityRepository(this.c)

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
