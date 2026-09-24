import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { performanceReviewRecordKinds } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import {
  performanceReviewSnapshotQuery,
  performanceReviewSourceTables,
} from "@/contexts/performance-review/infrastructure/adapters/lib/performance-review-snapshot-query"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ empty: ["snapshot"], migrated: ["schema"] })
})

afterAll(async () => {
  await local.dispose()
})

test("評価8台帳の現行全列を形式付き原記録に保持し、元にない版や記録時刻を創作しない", async () => {
  const migrated = await local.database("schema")
  const database = await local.database("snapshot")
  for (const kind of performanceReviewRecordKinds) {
    const source = performanceReviewSourceTables[kind]
    const actual = await migrated
      .prepare(`PRAGMA table_info(${source.table})`)
      .all<{ name: string }>()
    expect(actual.results.map((column) => column.name)).toEqual([...source.columns])
    await database
      .prepare(
        `CREATE TABLE ${source.table} (${source.columns.map((column) => `${column} ${column === source.key ? "INTEGER PRIMARY KEY" : "TEXT"}`).join(",")})`,
      )
      .run()
    const values = source.columns.map((column) =>
      column === source.key ? 0 : `${source.table}:${column}`,
    )
    await database
      .prepare(
        `INSERT INTO ${source.table} (${source.columns.join(",")}) VALUES (${source.columns.map(() => "?").join(",")})`,
      )
      .bind(...values)
      .run()
    const query = performanceReviewSnapshotQuery(kind, "0")
    if (query instanceof Error) throw query
    const row = await database
      .prepare(query.sql)
      .bind(...query.values)
      .first<{ snapshot_json: string }>()
    if (row === null) throw new Error(`missing ${kind}`)
    const snapshot = JSON.parse(row.snapshot_json)
    expect(snapshot).toEqual({
      format: kind,
      version: 1,
      source: Object.fromEntries(source.columns.map((column, index) => [column, values[index]])),
    })
    expect(performanceReviewSnapshotQuery(kind, "00")).toBeInstanceOf(Error)
  }
})
