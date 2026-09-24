import type { Context } from "@/env"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import type { LocalD1 } from "@tests/d1/support/start-local-d1"

type CreateLocalD1ContextOptions = Readonly<{ withCompanyOrganization?: boolean }>

/**
 * migration済みtemplateを複製した名前付きのローカルD1へ標準の従業員を投入し、本番と同じContextを合成する。
 * Repository・SQLの検証に使う。名前ごとに独立したDBなので、testごとに別の名前を渡す。
 */
export async function createLocalD1Context(
  local: LocalD1,
  name: string,
  options: CreateLocalD1ContextOptions = {},
): Promise<{ context: Context; db: D1Database }> {
  const db = await local.database(name)

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
