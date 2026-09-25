import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { ringiSnapshotQuery } from "@/contexts/ringi/infrastructure/adapters/lib/ringi-snapshot-query"

test("稟議起案と空キーを含む案件対応の全列を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE ringi_requests (
      id TEXT PRIMARY KEY, legacy_id TEXT, applicant_id TEXT, approver_id TEXT, title TEXT,
      amount INTEGER, reason TEXT, status TEXT, decided_at TEXT,
      decision_comment TEXT, created_at TEXT
    );
    CREATE TABLE ringi_procedure_bindings (
      id TEXT PRIMARY KEY, previous_ringi_id TEXT, request_key TEXT UNIQUE, ringi_id TEXT,
      application_id INTEGER, series_id TEXT, case_id TEXT,
      proposal_digest TEXT, created_at INTEGER
    );
    INSERT INTO ringi_requests VALUES (
      '0190004a-0000-7000-8000-000000000000','7','employee-a','employee-b','Equipment review',45000,'Team need','approved',
      '2026-09-15T10:00:00.000Z','Reviewed','2026-09-01T00:00:00.000Z'
    );
    INSERT INTO ringi_procedure_bindings VALUES (
      '3f0c8c1e-6d2a-4b7e-9a51-0c2d4e6f8a10',NULL,'','0190004a-0000-7000-8000-000000000000',9,'series-1','case-1','digest-1',1789480800000
    );
  `)
  const request = ringiSnapshotQuery("ringi-request-record", "0190004a-0000-7000-8000-000000000000")
  const binding = ringiSnapshotQuery("ringi-procedure-binding-record", "key:")
  if (request instanceof Error || binding instanceof Error) throw new Error("invalid test source")
  const requestRow = database.query(request.sql).get(...request.values) as { snapshot_json: string }
  const bindingRow = database.query(binding.sql).get(...binding.values) as { snapshot_json: string }
  expect(JSON.parse(requestRow.snapshot_json).request).toMatchObject({
    id: "0190004a-0000-7000-8000-000000000000",
    legacy_id: "7",
    amount: 45000,
    status: "approved",
    decision_comment: "Reviewed",
  })
  expect(JSON.parse(bindingRow.snapshot_json).binding).toMatchObject({
    id: "3f0c8c1e-6d2a-4b7e-9a51-0c2d4e6f8a10",
    request_key: "",
    ringi_id: "0190004a-0000-7000-8000-000000000000",
    application_id: 9,
    proposal_digest: "digest-1",
  })
  expect(ringiSnapshotQuery("ringi-request-record", "00")).toBeInstanceOf(Error)
  expect(ringiSnapshotQuery("ringi-procedure-binding-record", '""')).toBeInstanceOf(Error)
  database.close()
})
