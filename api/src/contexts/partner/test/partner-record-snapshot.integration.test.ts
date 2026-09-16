import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { partnerSnapshotQuery } from "@/contexts/partner/infrastructure/adapters/lib/partner-snapshot-query"
import type { PartnerRecordKind } from "@/contexts/partner/domain/definitions/partner-record-kind.definition"

test("取引先と契約の全列を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE partners (
      id INTEGER PRIMARY KEY, code TEXT, name TEXT, category TEXT, corporate_number TEXT,
      note TEXT, status TEXT, created_at TEXT
    );
    CREATE TABLE partner_contracts (
      id INTEGER PRIMARY KEY, partner_id INTEGER, title TEXT, contract_date TEXT,
      starts_on TEXT, ends_on TEXT, renewal_deadline TEXT, note TEXT, created_at TEXT
    );
    INSERT INTO partners VALUES (
      1,'vendor-1','Vendor One','supplier','1234567890123','Preferred','active',
      '2026-09-01T00:00:00.000Z'
    );
    INSERT INTO partner_contracts VALUES (
      2,1,'Service Agreement','2026-09-15','2026-10-01','2027-09-30',
      '2027-08-31','Annual renewal','2026-09-15T12:00:00.000Z'
    );
  `)
  const sources: ReadonlyArray<readonly [PartnerRecordKind, string]> = [
    ["partner-record", "1"],
    ["partner-contract-record", "2"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = partnerSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].partner).toMatchObject({
    id: 1,
    code: "vendor-1",
    name: "Vendor One",
    category: "supplier",
    corporate_number: "1234567890123",
    note: "Preferred",
    status: "active",
  })
  expect(snapshots[1].contract).toMatchObject({
    id: 2,
    partner_id: 1,
    title: "Service Agreement",
    contract_date: "2026-09-15",
    starts_on: "2026-10-01",
    ends_on: "2027-09-30",
    renewal_deadline: "2027-08-31",
    note: "Annual renewal",
  })
  expect(partnerSnapshotQuery("partner-record", "01")).toBeInstanceOf(Error)
  database.close()
})
