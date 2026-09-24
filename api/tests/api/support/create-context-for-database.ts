import type { Context } from "@/env"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"
import { seedPepperSecret } from "@tests/api/support/company/seed-password-hash.test-support"

/** 既存のテストD1へ本番と同じContext依存を合成する。D1の実装には依存しない。 */
export function createTestContextForDatabase(db: D1Database): Context {
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

  return context
}
