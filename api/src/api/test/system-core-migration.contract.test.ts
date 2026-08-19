import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const canonicalSchemaSql = readFileSync(
  new URL("../../contexts/system/infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const releasedMigrationSql = readFileSync(
  new URL("../../../migrations/0126_system_core.sql", import.meta.url),
  "utf8",
)
const authenticationRuntimeMigrationSql = readFileSync(
  new URL("../../../migrations/0145_finalize_system_auth_runtime.sql", import.meta.url),
  "utf8",
)

test("released System core migrations match the canonical schema contract", () => {
  const challengeStart = canonicalSchemaSql.indexOf("CREATE TABLE system_password_reset_challenges")
  const sessionsStart = canonicalSchemaSql.indexOf("CREATE TABLE system_sessions", challengeStart)
  expect(challengeStart).toBeGreaterThan(0)
  expect(sessionsStart).toBeGreaterThan(challengeStart)
  expect(
    `${canonicalSchemaSql.slice(0, challengeStart)}${canonicalSchemaSql.slice(sessionsStart)}`,
  ).toBe(releasedMigrationSql)
  expect(authenticationRuntimeMigrationSql.trimEnd()).toBe(
    canonicalSchemaSql.slice(challengeStart, sessionsStart).trimEnd(),
  )
})
