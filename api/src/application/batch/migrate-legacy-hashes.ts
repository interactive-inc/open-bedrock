// 旧形式ハッシュ（固定ソルト SHA-256）を PBKDF2 ラップ形式に一括移行するユースケース。
// ユーザーの平文パスワード不要で実行できる hash-of-hash 方式。
// 次回ログイン時に authenticate-employee が純正 PBKDF2 へ昇格する。

import { isLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { wrapLegacyHash } from "@/domain/auth/wrap-legacy-hash"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type MigrationResult = {
  total: number
  migrated: number
  skipped: number
  failed: number
}

export class MigrateLegacyHashes {
  constructor(private readonly c: Context) {}

  async run(): Promise<MigrationResult | Error> {
    const repository = new EmployeeRepository(this.c)

    const found = await repository.findAllWithNonPbkdf2Hash()

    if (found instanceof Error) {
      return found
    }

    let migrated = 0
    let skipped = 0
    let failed = 0

    for (const employee of found) {
      if (isLegacyPasswordHash(employee.passwordHash) === false) {
        skipped = skipped + 1
        continue
      }

      const wrapped = await wrapLegacyHash(employee.passwordHash)
      const updateResult = await repository.updatePasswordHash(employee.id, wrapped)

      if (updateResult instanceof Error) {
        console.error(`[migrate-legacy-hashes] failed for employee ${employee.code}:`, updateResult)
        failed = failed + 1
        continue
      }

      migrated = migrated + 1
    }

    return { total: found.length, migrated, skipped, failed }
  }
}
