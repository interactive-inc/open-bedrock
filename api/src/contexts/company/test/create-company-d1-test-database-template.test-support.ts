import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { createCompanySqliteTestDatabaseTemplate } from "@/contexts/company/test/create-company-sqlite-test-database-template.test-support"

/** schema の適用結果だけを共有し、呼び出しごとに書き込み可能な独立 DB を返す。 */
export function createCompanyD1TestDatabaseTemplate(schemaSql: string) {
  const template = createCompanySqliteTestDatabaseTemplate(schemaSql)

  return () => {
    const copy = template.createDatabase()
    return Object.assign(createCompanyD1TestDatabase(copy), { close: () => copy.close() })
  }
}
