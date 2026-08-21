import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const canonicalSchemaSql = readFileSync(
  new URL("../../contexts/system/infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const releasedMigrationSql = readFileSync(
  new URL("../../../migrations/0001_system_core.sql", import.meta.url),
  "utf8",
)

test("released System core migration matches the canonical schema contract", () => {
  expect(releasedMigrationSql).toBe(canonicalSchemaSql)
})
