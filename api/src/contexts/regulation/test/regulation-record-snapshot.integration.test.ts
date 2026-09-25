import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { regulationSnapshotQuery } from "@/contexts/regulation/infrastructure/adapters/lib/regulation-snapshot-query"
import type { RegulationRecordKind } from "@/contexts/regulation/domain/definitions/regulation-record-kind.definition"

test("規程と改定版の本文・有効日・版を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE regulations (
      id TEXT PRIMARY KEY, legacy_id TEXT, code TEXT, title TEXT, category TEXT, status TEXT, created_at TEXT
    );
    CREATE TABLE regulation_versions (
      id TEXT PRIMARY KEY, legacy_id TEXT, regulation_id TEXT, version INTEGER, body_md TEXT,
      effective_on TEXT, note TEXT, created_at TEXT
    );
    INSERT INTO regulations VALUES (
      '0190001f-0000-7000-8000-000000000001','1','work-rules','Work Rules','personnel','active','2026-09-01T00:00:00.000Z'
    );
    INSERT INTO regulation_versions VALUES (
      '01900020-0000-7000-8000-000000000002',NULL,'0190001f-0000-7000-8000-000000000001',3,'# Work Rules','2026-10-01','Approved revision','2026-09-15T12:00:00.000Z'
    );
  `)
  const sources: ReadonlyArray<readonly [RegulationRecordKind, string]> = [
    ["regulation-record", "0190001f-0000-7000-8000-000000000001"],
    ["regulation-version-record", "01900020-0000-7000-8000-000000000002"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = regulationSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].regulation).toMatchObject({
    id: "0190001f-0000-7000-8000-000000000001",
    legacy_id: "1",
    code: "work-rules",
    title: "Work Rules",
    category: "personnel",
    status: "active",
  })
  expect(snapshots[1].revision).toMatchObject({
    id: "01900020-0000-7000-8000-000000000002",
    legacy_id: null,
    regulation_id: "0190001f-0000-7000-8000-000000000001",
    version: 3,
    body_md: "# Work Rules",
    effective_on: "2026-10-01",
    note: "Approved revision",
  })
  expect(regulationSnapshotQuery("regulation-record", "1")).toBeInstanceOf(Error)
  database.close()
})
