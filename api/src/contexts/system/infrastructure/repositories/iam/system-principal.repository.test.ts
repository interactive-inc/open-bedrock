import { expect, test } from "bun:test"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"

const schema = `CREATE TABLE system_principals (
  id TEXT PRIMARY KEY, account_id TEXT UNIQUE, kind TEXT, name TEXT,
  connector_id TEXT, revision INTEGER, created_at INTEGER, updated_at INTEGER
)`

test("指定AccountのPrincipalだけを一括復元し、未指定の主体を混ぜない", async () => {
  let queries = 0
  const database = createSystemD1TestDatabase(schema, {
    onQuery: () => {
      queries += 1
    },
  })
  const ids = Array.from({ length: 1001 }, (_, index) => `account-${index}`)
  await database
    .prepare(`INSERT INTO system_principals
    SELECT 'principal:' || value, value, 'human', 'Member', NULL, 1, 0, 0 FROM json_each(?1)`)
    .bind(JSON.stringify([...ids, "other-account"]))
    .run()
  const repository = new SystemPrincipalRepository({ env: { DB: database } })
  queries = 0
  const principals = await repository.findMany({ accountIds: [...ids, ids[0]!, "missing"] })
  if (principals instanceof Error) throw principals
  expect(principals).toHaveLength(1001)
  expect(principals.some((principal) => principal.accountId === "other-account")).toBe(false)
  expect(queries).toBe(1)
  queries = 0
  expect(await repository.findMany({ accountIds: [] })).toEqual([])
  expect(queries).toBe(0)
  expect(await repository.findMany()).toHaveLength(1002)
})

test("対象の壊れたPrincipalとDB障害では一括結果を返さない", async () => {
  const database = createSystemD1TestDatabase(schema)
  await database.exec(`INSERT INTO system_principals VALUES
    ('principal:valid', 'account:valid', 'human', 'Member', NULL, 1, 0, 0),
    ('principal:invalid', 'account:invalid', 'unknown', 'Member', NULL, 1, 0, 0)`)
  const repository = new SystemPrincipalRepository({ env: { DB: database } })
  expect(await repository.findMany({ accountIds: ["account:valid"] })).toHaveLength(1)
  expect(
    await repository.findMany({ accountIds: ["account:valid", "account:invalid"] }),
  ).toBeInstanceOf(Error)
  await database.exec("DROP TABLE system_principals")
  expect(await repository.findMany({ accountIds: ["account:valid"] })).toBeInstanceOf(Error)
})
