import type { Context } from "@/env"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"

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
