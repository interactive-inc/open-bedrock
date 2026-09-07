import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { SystemOperationReceiptEntity } from "@system/domain/entities/system-operation-receipt.entity"
import { SystemOperationReceiptRepository } from "./system-operation-receipt.repository"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { systemOperationReceipts } from "@system/infrastructure/schema/system-operation-receipt"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"

const ddl = readFileSync(
  new URL("../../schema/system-operation-receipt.sql", import.meta.url),
  "utf8",
)
const input = {
  operationKey: "record.create",
  scopeKey: "scope:1",
  commandId: "command:1",
  actorAccountId: "account:1",
  actorPrincipalId: "principal:1",
  requestDigest: "a".repeat(64),
  recordedAt: 1000,
  result: { created: 1, ids: ["record:1"] },
}
async function fixture() {
  const sqlite = new Database(":memory:")
  sqlite.exec(ddl)
  sqlite.exec("CREATE TABLE test_business_records (id TEXT PRIMARY KEY)")
  const database = wrapSystemD1TestDatabase(sqlite)
  const repository = new SystemOperationReceiptRepository({ env: { DB: database } })
  const entity = await SystemOperationReceiptEntity.create(input)
  if (entity instanceof Error) throw entity
  return { sqlite, database, repository, entity }
}
async function failure(operation: Promise<unknown>) {
  return operation.then(
    () => null,
    (cause: unknown) => cause,
  )
}

test("準備だけでは保存せず、業務変更と結果を一緒に確定する", async () => {
  const { sqlite, database, repository, entity } = await fixture()
  const statement = repository.prepare(entity)
  expect(await repository.find(input)).toBeNull()
  await database.batch([
    database.prepare("INSERT INTO test_business_records VALUES ('record:1')"),
    statement,
  ])
  const read = await repository.find(input)
  expect(read).toBeInstanceOf(SystemOperationReceiptEntity)
  if (!(read instanceof SystemOperationReceiptEntity)) throw read
  expect(read.props).toEqual(entity.props)
  expect(Object.isFrozen(read.props)).toBe(true)
  expect(sqlite.query("SELECT count(*) AS count FROM test_business_records").get()).toEqual({
    count: 1,
  })
  expect(
    await failure(
      database.batch([
        database.prepare("INSERT INTO test_business_records VALUES ('record:2')"),
        repository.prepare(entity),
      ]),
    ),
  ).toBeInstanceOf(Error)
  expect(sqlite.query("SELECT count(*) AS count FROM test_business_records").get()).toEqual({
    count: 1,
  })
  expect(() =>
    sqlite.exec("UPDATE system_operation_receipts SET actor_account_id = 'other'"),
  ).toThrow()
  expect(() => sqlite.exec("DELETE FROM system_operation_receipts")).toThrow()
})

test("結果読取にも同じtransactionの認可条件を適用する", async () => {
  const { database, repository, entity } = await fixture()
  await database.batch([repository.prepare(entity)])
  const result = await repository.find(input, [
    database.prepare("SELECT json_extract('{}', 'denied')"),
  ])
  expect(result).toBeInstanceOf(Error)
})

test("対象範囲ごとにキーを分け、結果の不正なdigestを成功として返さない", async () => {
  const { sqlite, database, repository, entity } = await fixture()
  const other = await SystemOperationReceiptEntity.create({ ...input, scopeKey: "scope:2" })
  if (other instanceof Error) throw other
  await database.batch([repository.prepare(entity), repository.prepare(other)])
  expect(await repository.find({ ...input, scopeKey: "scope:missing" })).toBeNull()
  sqlite.exec("DROP TRIGGER system_operation_receipts_no_update")
  sqlite.run(
    "UPDATE system_operation_receipts SET result_json = '{\"created\":999}' WHERE scope_key = 'scope:1'",
  )
  expect(await repository.find(input)).toBeInstanceOf(Error)
  expect(await repository.find({ ...input, scopeKey: "scope:2" })).toBeInstanceOf(
    SystemOperationReceiptEntity,
  )
})

test("入力の識別子・digest・結果JSONと容量を検証する", async () => {
  for (const override of [
    { commandId: "command\n" },
    { requestDigest: "invalid" },
    { requestDigest: "a".repeat(64) + "\n" },
    { actorPrincipalId: "" },
    { recordedAt: -1 },
    { result: undefined },
    { result: "x".repeat(1_000_001) },
  ])
    expect(await SystemOperationReceiptEntity.create({ ...input, ...override })).toBeInstanceOf(
      Error,
    )
  const first = await SystemOperationReceiptEntity.create({ ...input, result: { b: 2, a: 1 } })
  const second = await SystemOperationReceiptEntity.create({ ...input, result: { a: 1, b: 2 } })
  if (first instanceof Error || second instanceof Error)
    throw new Error("canonical result is invalid")
  expect(first.props.resultJson).toBe(second.props.resultJson)
  expect(first.props.resultDigest).toBe(second.props.resultDigest)
})

test("DDLとDrizzleの列を一致させ、DBでも壊れたJSONを拒否する", async () => {
  const { sqlite, database, repository, entity } = await fixture()
  const columns = sqlite
    .query<{ name: string }, []>("PRAGMA table_info(system_operation_receipts)")
    .all()
    .map((row) => row.name)
    .sort()
  expect(columns).toEqual(
    getTableConfig(systemOperationReceipts)
      .columns.map((column) => column.name)
      .sort(),
  )
  await database.batch([repository.prepare(entity)])
  sqlite.exec("DROP TRIGGER system_operation_receipts_no_update")
  expect(() =>
    sqlite.exec("UPDATE system_operation_receipts SET result_json = 'not json'"),
  ).toThrow()
  expect(() =>
    sqlite.exec("UPDATE system_operation_receipts SET result_digest = 'invalid'"),
  ).toThrow()
  expect(() => sqlite.exec("UPDATE system_operation_receipts SET recorded_at = 1.5")).toThrow()
})

test("各製品の追記migrationが同じtable・索引・変更禁止triggerを作る", () => {
  const canonical = new Database(":memory:")
  const released = new Database(":memory:")
  canonical.exec(ddl)
  for (const name of [
    "create_system_operation_receipts",
    "guard_system_operation_receipt_update",
    "guard_system_operation_receipt_delete",
  ])
    released.exec(readReleasedSystemMigration(name))
  const structure = (database: Database) =>
    database
      .query(
        "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
      )
      .all()
  expect(structure(released)).toEqual(structure(canonical))
  canonical.close()
  released.close()
})
