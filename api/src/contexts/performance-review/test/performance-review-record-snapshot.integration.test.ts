import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { performanceReviewRecordKinds } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import {
  performanceReviewSnapshotQuery,
  performanceReviewSourceTables,
} from "@/contexts/performance-review/infrastructure/adapters/lib/performance-review-snapshot-query"

test("評価8台帳の現行全列を形式付き原記録に保持し、元にない版や記録時刻を創作しない", async () => {
  const migrated = createD1TestDatabase(loadSchema())
  const database = new Database(":memory:")
  for (const kind of performanceReviewRecordKinds) {
    const source = performanceReviewSourceTables[kind]
    const actual = await migrated
      .prepare(`PRAGMA table_info(${source.table})`)
      .all<{ name: string }>()
    expect(actual.results.map((column) => column.name)).toEqual([...source.columns])
    database.exec(
      `CREATE TABLE ${source.table} (${source.columns.map((column) => `${column} ${column === source.key ? "INTEGER PRIMARY KEY" : "TEXT"}`).join(",")})`,
    )
    const values = source.columns.map((column) =>
      column === source.key ? 0 : `${source.table}:${column}`,
    )
    database
      .query(
        `INSERT INTO ${source.table} (${source.columns.join(",")}) VALUES (${source.columns.map(() => "?").join(",")})`,
      )
      .run(...values)
    const query = performanceReviewSnapshotQuery(kind, "0")
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    const snapshot = JSON.parse(row.snapshot_json)
    expect(snapshot).toEqual({
      format: kind,
      version: 1,
      source: Object.fromEntries(source.columns.map((column, index) => [column, values[index]])),
    })
    expect(performanceReviewSnapshotQuery(kind, "00")).toBeInstanceOf(Error)
  }
  database.close()
})
