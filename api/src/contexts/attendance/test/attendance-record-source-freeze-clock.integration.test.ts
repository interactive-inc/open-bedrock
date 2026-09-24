import { expect, test } from "bun:test"
import { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"
import { ClockIn } from "@/contexts/attendance/application/clock-in"
import { ClockOut } from "@/contexts/attendance/application/clock-out"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { ConflictError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"

test("実DBの書込み停止が通常の出勤と退勤で409になり、解除後に再開する", async () => {
  const f = await createAttendanceRecordSourceFixture()
  const context = createTestContextForDatabase(f.database)
  await f.database
    .exec(`INSERT INTO company_employees (id,official_name,employee_code,created_at,updated_at)
    VALUES ('employee:second','Second','SECOND',0,0)`)
  const repository = openSystemRecordSourceFreezes({ env: f.context.env, assertions: [] })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "attendance",
    actorAccountId: f.authentication.accountId,
    reason: "Preserve records",
  }
  expect(
    await new CreateRecordSourceFreeze({ repository }).execute(command, f.clock.now),
  ).toMatchObject({ kind: "created" })
  const clockIn = {
    employeeId: toWorkforceEmployeeId("employee:second"),
    now: "2026-09-01T08:00:00Z",
    note: null,
  }
  const clockOut = {
    employeeId: toWorkforceEmployeeId("employee:worker"),
    now: "2026-09-01T08:00:00Z",
  }
  for (const failure of [
    await new ClockIn({ recordRepository: new AttendanceRecordRepository(context) }).run(clockIn),
    await new ClockOut({ recordRepository: new AttendanceRecordRepository(context) }).run(clockOut),
  ]) {
    expect(failure).toBeInstanceOf(ConflictError)
    if (!(failure instanceof ConflictError)) throw new Error("Expected frozen source conflict")
    expect(failure.code).toBe("attendance_record_source_frozen")
    expect(toHttpException(failure).status).toBe(409)
  }
  expect(
    await f.database
      .prepare("SELECT status FROM attendance_records WHERE id=1")
      .first<string>("status"),
  ).toBe("open")
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM attendance_records").first<number>("n"),
  ).toBe(2)
  expect(
    await new ReleaseRecordSourceFreeze({ repository }).execute(
      { ...command, reason: "Resume records" },
      f.clock.now,
    ),
  ).toMatchObject({ kind: "released" })
  expect(
    await new ClockIn({ recordRepository: new AttendanceRecordRepository(context) }).run(clockIn),
  ).toMatchObject({ status: "open" })
  expect(
    await new ClockOut({ recordRepository: new AttendanceRecordRepository(context) }).run(clockOut),
  ).toMatchObject({ status: "closed" })
})
