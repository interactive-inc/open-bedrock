import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import { ListAttendanceRecordInventoryAdapter } from "@/contexts/attendance/infrastructure/adapters/list-attendance-record-inventory.adapter"
import { RevalidateAttendanceRecordSourceAdapter } from "@/contexts/attendance/infrastructure/adapters/revalidate-attendance-record-source.adapter"
import { execSql } from "@tests/d1/support/exec-sql"

/** migration済みのローカルD1とSystemの付与権限で打刻原記録を検証する。 */
export async function createAttendanceRecordSourceFixture(database: D1Database) {
  const clock = { now: new Date() }
  const authentication = {
    accountId: zAccountId.parse("cc97e08f-b4a0-4e2a-9a79-31e6d95f9208"),
    tokenVersion: 0,
    issuedAtMs: clock.now.getTime() - 1000,
    expiresAtMs: clock.now.getTime() + 3_600_000,
    machineCredentialId: null,
    identityBindingId: null,
  }
  await execSql(
    database,
    `
    INSERT INTO system_accounts (id,status,token_version,created_at,updated_at)
      VALUES ('cc97e08f-b4a0-4e2a-9a79-31e6d95f9208','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at)
      VALUES ('f1655ee3-33f1-4e13-bff9-efa2adc1538d','cc97e08f-b4a0-4e2a-9a79-31e6d95f9208','human','Recorder',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
      VALUES ('0a05519b-05c9-4925-8b15-fcb647569867','attendance:test-recorder','custom','Recorder',0,0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('0a05519b-05c9-4925-8b15-fcb647569867','attendance:read:all');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('25df26f0-af9b-43d9-8547-ddcff1987502','cc97e08f-b4a0-4e2a-9a79-31e6d95f9208','0a05519b-05c9-4925-8b15-fcb647569867',0);
    INSERT INTO company_employees (id,official_name,employee_code,email,phone,created_at,updated_at)
      VALUES ('aea9e258-3d37-4735-a897-5d1eb8aa7c29','Worker','WORKER',NULL,NULL,0,0);
    INSERT INTO attendance_records (id,employee_id,work_date,clock_in_at,clock_out_at,work_minutes,note,status)
      VALUES ('01900016-0000-7000-8000-000000000001','aea9e258-3d37-4735-a897-5d1eb8aa7c29','2026-09-01','2026-09-01T00:00:00Z',NULL,NULL,'Original note','open'),
      ('01900016-0000-7000-8000-000000000002','aea9e258-3d37-4735-a897-5d1eb8aa7c29','2026-08-31','2026-08-31T00:00:00Z','2026-08-31T08:00:00Z',480,NULL,'closed');
    CREATE TABLE capture_test_receipts (id TEXT PRIMARY KEY);`,
  )
  const context = {
    env: { DB: database },
    var: { now: () => clock.now, bearerReadAuthentication: authentication },
  }
  const input = {
    recordId: "01900016-0000-7000-8000-000000000001",
    sourceNamespace: "example-source",
  }
  return {
    database,
    clock,
    authentication,
    context,
    input,
    capture: new CaptureAttendanceRecordAdapter(context),
    inventory: new ListAttendanceRecordInventoryAdapter(context),
    revalidate: new RevalidateAttendanceRecordSourceAdapter({
      ...context,
      sourceNamespace: input.sourceNamespace,
    }),
  }
}
