import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import { ListAttendanceRecordInventoryAdapter } from "@/contexts/attendance/infrastructure/adapters/list-attendance-record-inventory.adapter"
import { RevalidateAttendanceRecordSourceAdapter } from "@/contexts/attendance/infrastructure/adapters/revalidate-attendance-record-source.adapter"

const schema = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

/** 適用後の実schemaとSystemの付与権限で打刻原記録を検証する。 */
export async function createAttendanceRecordSourceFixture() {
  const database = createSystemD1TestDatabase(schema)
  const clock = { now: new Date() }
  const authentication = {
    accountId: zAccountId.parse("account:recorder"),
    tokenVersion: 0,
    issuedAtMs: clock.now.getTime() - 1000,
    expiresAtMs: clock.now.getTime() + 3_600_000,
    machineCredentialId: null,
    identityBindingId: null,
  }
  await database.exec(`
    INSERT INTO system_accounts (id,status,token_version,created_at,updated_at)
      VALUES ('account:recorder','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at)
      VALUES ('principal:recorder','account:recorder','human','Recorder',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
      VALUES ('role:recorder','attendance:test-recorder','custom','Recorder',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:recorder','attendance:read:all');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
      VALUES ('binding:recorder','account:recorder','role:recorder',0);
    INSERT INTO company_employees (id,official_name,employee_code,email,phone,created_at,updated_at)
      VALUES ('employee:worker','Worker','WORKER',NULL,NULL,0,0);
    INSERT INTO attendance_records (id,employee_id,work_date,clock_in_at,clock_out_at,work_minutes,note,status)
      VALUES (1,'employee:worker','2026-09-01','2026-09-01T00:00:00Z',NULL,NULL,'Original note','open'),
      (2,'employee:worker','2026-08-31','2026-08-31T00:00:00Z','2026-08-31T08:00:00Z',480,NULL,'closed');
    CREATE TABLE capture_test_receipts (id TEXT PRIMARY KEY);`)
  const context = {
    env: { DB: database },
    var: { now: () => clock.now, bearerReadAuthentication: authentication },
  }
  const input = { recordId: 1, sourceNamespace: "example-source" }
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
