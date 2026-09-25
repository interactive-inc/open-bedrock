import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  decodeGovernanceRecordId,
  encodeGovernanceRecordId,
  governanceRecordKinds,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import {
  governanceSnapshotQuery,
  governanceSourceTables,
} from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ empty: ["snapshot"], migrated: ["schema"] })
})

afterAll(async () => {
  await local.dispose()
})

test("規程8台帳の現行全列と空・区切り文字を含む複合キーを原記録に残す", async () => {
  const migrated = await local.database("schema")
  const database = await local.database("snapshot")
  for (const kind of governanceRecordKinds) {
    const source = governanceSourceTables[kind]
    const actual = await migrated
      .prepare(`PRAGMA table_info(${source.table})`)
      .all<{ name: string }>()
    expect(actual.results.map((column) => column.name)).toEqual([...source.columns])
    await database
      .prepare(
        `CREATE TABLE ${source.table} (${source.columns.map((column) => `${column} TEXT`).join(",")})`,
      )
      .run()
    const values = source.columns.map((column, index) =>
      source.keys.includes(column as never)
        ? index % 2 === 0
          ? ""
          : "a:b"
        : `${source.table}:${column}`,
    )
    await database
      .prepare(
        `INSERT INTO ${source.table} (${source.columns.join(",")}) VALUES (${source.columns.map(() => "?").join(",")})`,
      )
      .bind(...values)
      .run()
    const keyParts = source.keys.map((key) => values[source.columns.indexOf(key as never)])
    const id = encodeGovernanceRecordId(keyParts)
    expect(decodeGovernanceRecordId(id, source.keys.length)).toEqual(keyParts)
    const query = governanceSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = await database
      .prepare(query.sql)
      .bind(...query.values)
      .first<{ snapshot_json: string }>()
    if (row === null) throw new Error(`missing ${kind}`)
    expect(JSON.parse(row.snapshot_json)).toEqual({
      format: kind,
      version: source.formatVersion,
      source: Object.fromEntries(source.columns.map((column, index) => [column, values[index]])),
    })
    expect(governanceSnapshotQuery(kind, `${id}x`)).toBeInstanceOf(Error)
  }
})
