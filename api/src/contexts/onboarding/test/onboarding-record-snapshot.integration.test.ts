import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  encodeOnboardingTemplateTaskRecordId,
  type OnboardingRecordKind,
} from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
import { onboardingSnapshotQuery } from "@/contexts/onboarding/infrastructure/adapters/lib/onboarding-snapshot-query"

test("入退社手続き5台帳の全列と空の複合キーを原記録に残す", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE onboarding_templates (id INTEGER PRIMARY KEY, code TEXT, name TEXT, kind TEXT, description TEXT);
    CREATE TABLE onboarding_template_tasks (template_code TEXT, code TEXT, title TEXT, sort_order INTEGER, owner_role TEXT);
    CREATE TABLE onboarding_assignments (id INTEGER PRIMARY KEY, employee_id TEXT, template_code TEXT, kind TEXT, status TEXT, assigned_at TEXT, lifecycle_action_id TEXT);
    CREATE TABLE onboarding_tasks (id INTEGER PRIMARY KEY, assignment_id INTEGER, template_task_code TEXT, title TEXT, sort_order INTEGER, status TEXT, completed_at TEXT);
    CREATE TABLE onboarding_lifecycle_deliveries (job_id TEXT PRIMARY KEY, action_id TEXT, created_at INTEGER, outcome TEXT, assignment_id INTEGER, processed_at INTEGER);
    INSERT INTO onboarding_templates VALUES (0,'start','Start','hire','Checklist');
    INSERT INTO onboarding_template_tasks VALUES ('','','Create account',1,'IT');
    INSERT INTO onboarding_assignments VALUES (0,'employee-1','start','hire','active','2026-09-01T00:00:00Z','action-1');
    INSERT INTO onboarding_tasks VALUES (0,0,'','Create account',1,'completed','2026-09-02T00:00:00Z');
    INSERT INTO onboarding_lifecycle_deliveries VALUES ('job-1','action-1',1788220800000,'assigned',0,1788307200000);
  `)
  const sources: ReadonlyArray<readonly [OnboardingRecordKind, string, string]> = [
    ["onboarding-template-record", "0", "template"],
    [
      "onboarding-template-task-record",
      encodeOnboardingTemplateTaskRecordId("", ""),
      "template_task",
    ],
    ["onboarding-assignment-record", "0", "assignment"],
    ["onboarding-task-record", "0", "task"],
    ["onboarding-lifecycle-delivery-record", "job-1", "delivery"],
  ]
  for (const [kind, id, key] of sources) {
    const query = onboardingSnapshotQuery(kind, id)
    if (query instanceof Error) throw query
    const row = database.query(query.sql).get(...query.values) as { snapshot_json: string } | null
    if (row === null) throw new Error(`missing ${kind}`)
    const snapshot = JSON.parse(row.snapshot_json)
    expect(snapshot.format).toBe(kind)
    expect(snapshot.version).toBe(1)
    expect(snapshot[key]).toBeDefined()
  }
  expect(onboardingSnapshotQuery("onboarding-template-record", "00")).toBeInstanceOf(Error)
  expect(onboardingSnapshotQuery("onboarding-template-task-record", "task:01:a")).toBeInstanceOf(
    Error,
  )
  database.close()
})
