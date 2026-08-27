import type { Context } from "@/env"
import { schema } from "@/schema"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { drizzle } from "drizzle-orm/d1"
import { seedPepperSecret } from "@tests/api/support/company/seed-password-hash.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

type CreateTestContextOptions = Readonly<{ withCompanyOrganization?: boolean }>

/**
 * テスト用: スキーマを流し込んだインメモリ D1 と Drizzle を載せた Context を作る。
 * リポジトリ（new XxxRepository(context)）を直接叩くために使う。
 */
export async function createTestContext(
  options: CreateTestContextOptions = {},
): Promise<{ context: Context; db: D1Database }> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(db, [
    ...seedEmployees,
    { id: 7, code: "E007", name: "Repository Test Employee 7" },
    { id: 8, code: "E008", name: "Repository Test Employee 8" },
  ])
  if (options.withCompanyOrganization === true) {
    await initializeStandardCompanyTestState(db)
  }

  return { context: createTestContextForDatabase(db), db }
}

/** 既存のテストD1へ本番と同じContext依存を合成する。 */
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
