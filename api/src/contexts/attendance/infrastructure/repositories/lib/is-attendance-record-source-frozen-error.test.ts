import { expect, test } from "bun:test"
import { isAttendanceRecordSourceFrozenError } from "@/contexts/attendance/infrastructure/repositories/lib/is-attendance-record-source-frozen-error"

test("DB拒否の原因だけを識別し、SQL文・入力値・別の制約を停止扱いしない", () => {
  expect(
    isAttendanceRecordSourceFrozenError(
      new Error("Failed query", {
        cause: new Error("D1_ERROR: attendance_record_source_frozen: SQLITE_CONSTRAINT"),
      }),
    ),
  ).toBe(true)
  expect(isAttendanceRecordSourceFrozenError(new Error("attendance_record_source_frozen"))).toBe(
    true,
  )
  for (const error of [
    new Error(
      "Failed query: INSERT INTO attendance_records VALUES ('attendance_record_source_frozen')",
    ),
    new Error("UNIQUE constraint failed: attendance_records.employee_id"),
    new Error("attendance_record_source_frozen_other"),
    null,
    "attendance_record_source_frozen",
  ]) {
    expect(isAttendanceRecordSourceFrozenError(error)).toBe(false)
  }
  const cyclic = new Error("unrelated")
  cyclic.cause = cyclic
  expect(isAttendanceRecordSourceFrozenError(cyclic)).toBe(false)
})
