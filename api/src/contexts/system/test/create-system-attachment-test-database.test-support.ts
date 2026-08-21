import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { readFileSync } from "node:fs"

/** System の添付機能だけを検証できる、製品 migration 非依存の D1 テストDBを作る。 */
export function createSystemAttachmentTestDatabase(): D1Database {
  const coreSchema = readFileSync(
    new URL("../infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  )
  const attachmentSchema = readFileSync(
    new URL("../infrastructure/schema/system-attachment.sql", import.meta.url),
    "utf8",
  )

  return createSystemD1TestDatabase(`${coreSchema}\n${attachmentSchema}`)
}
