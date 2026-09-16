import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { recruitmentSnapshotQuery } from "@/contexts/recruitment/infrastructure/adapters/lib/recruitment-snapshot-query"
import type { RecruitmentRecordKind } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"

test("募集ポジションと応募者の全列を原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE job_openings (
      id INTEGER PRIMARY KEY, title TEXT, department_code TEXT, status TEXT,
      note TEXT, created_at TEXT
    );
    CREATE TABLE recruitment_candidates (
      id INTEGER PRIMARY KEY, position_id INTEGER, name TEXT, email TEXT,
      source TEXT, stage TEXT, note TEXT, created_at TEXT
    );
    INSERT INTO job_openings VALUES (
      1,'Engineer','engineering','open','Remote','2026-09-01T00:00:00.000Z'
    );
    INSERT INTO recruitment_candidates VALUES (
      2,1,'Applicant','person@example.test','referral','interview','Private',
      '2026-09-15T12:00:00.000Z'
    );
  `)
  const sources: ReadonlyArray<readonly [RecruitmentRecordKind, string]> = [
    ["recruitment-position-record", "1"],
    ["recruitment-candidate-record", "2"],
  ]
  const snapshots = sources.map(([kind, id]) => {
    const query = recruitmentSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    return JSON.parse(row.snapshot_json)
  })
  expect(snapshots[0].position).toMatchObject({
    id: 1,
    title: "Engineer",
    department_code: "engineering",
    status: "open",
    note: "Remote",
  })
  expect(snapshots[1].candidate).toMatchObject({
    id: 2,
    position_id: 1,
    name: "Applicant",
    email: "person@example.test",
    source: "referral",
    stage: "interview",
    note: "Private",
  })
  expect(recruitmentSnapshotQuery("recruitment-position-record", "01")).toBeInstanceOf(Error)
  database.close()
})
