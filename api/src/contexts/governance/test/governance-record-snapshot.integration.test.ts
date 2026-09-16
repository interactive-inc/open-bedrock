import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import {
  decodeGovernanceRecordId,
  encodeGovernanceRecordId,
  governanceRecordKinds,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import {
  governanceSnapshotQuery,
  governanceSourceTables,
} from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"

test("規程8台帳の現行全列と空・区切り文字を含む複合キーを原記録に残す", async () => {
  const migrated = createD1TestDatabase(loadSchema())
  const database = new Database(":memory:")
  for (const kind of governanceRecordKinds) {
    const source = governanceSourceTables[kind]
    const actual = await migrated
      .prepare(`PRAGMA table_info(${source.table})`)
      .all<{ name: string }>()
    expect(actual.results.map((column) => column.name)).toEqual([...source.columns])
    database.exec(
      `CREATE TABLE ${source.table} (${source.columns.map((column) => `${column} TEXT`).join(",")})`,
    )
    const values = source.columns.map((column, index) =>
      source.keys.includes(column as never)
        ? index % 2 === 0
          ? ""
          : "a:b"
        : `${source.table}:${column}`,
    )
    database
      .query(
        `INSERT INTO ${source.table} (${source.columns.join(",")}) VALUES (${source.columns.map(() => "?").join(",")})`,
      )
      .run(...values)
    const keyParts = source.keys.map((key) => values[source.columns.indexOf(key as never)])
    const id = encodeGovernanceRecordId(keyParts)
    expect(decodeGovernanceRecordId(id, source.keys.length)).toEqual(keyParts)
    const query = governanceSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    expect(JSON.parse(row.snapshot_json)).toEqual({
      format: kind,
      version: 1,
      source: Object.fromEntries(source.columns.map((column, index) => [column, values[index]])),
    })
    expect(governanceSnapshotQuery(kind, `${id}x`)).toBeInstanceOf(Error)
  }
  database.close()
})
