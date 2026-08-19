import type { Context } from "@/env"
import { schema } from "@/schema"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { drizzle } from "drizzle-orm/d1"
import { seedPepperSecret } from "@/contexts/company/infrastructure/seed/seed-password-hash"

/**
 * テスト用: スキーマを流し込んだインメモリ D1 と Drizzle を載せた Context を作る。
 * リポジトリ（new XxxRepository(context)）を直接叩くために使う。
 */
export function createTestContext(): { context: Context; db: D1Database } {
  const db = createD1TestDatabase(loadSchema())

  const context: Context = {
    var: {
      database: drizzle(db, { schema }),
      session: null,
      auditContext: {
        requestId: "00000000-0000-4000-8000-000000000000",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
    env: {
      DB: db,
      JWT_SECRET: "repository-test-secret",
      PEPPER_SECRET: seedPepperSecret,
      AUDIT_HMAC_SECRET: "repository-test-audit-hmac-secret",
      COMPANY_TIME_ZONE: "Asia/Tokyo",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  }

  return { context, db }
}
