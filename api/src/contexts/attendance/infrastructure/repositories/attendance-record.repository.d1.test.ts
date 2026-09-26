import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["open-close", "create-then-findopenbyemployeeid-round-trips"],
  })
})

afterAll(async () => {
  await local.dispose()
})

function openRecord(employeeId: number, clockInAt: string): AttendanceRecord {
  return AttendanceRecord.create({
    employeeId: toWorkforceEmployeeId(testEmployeeId(employeeId)),
    clockInAt,
    note: null,
  })
}

describe("AttendanceRecordRepository on local D1", () => {
  test("allows one open record per employee, closes it once and allows the next open", async () => {
    const { context } = await createLocalD1Context(local, "open-close")

    const repository = new AttendanceRecordRepository(context)

    const first = await repository.create(openRecord(1, "2026-03-15T09:00:00.000Z"))

    if (first instanceof Error) throw first

    expect(await repository.create(openRecord(1, "2026-03-15T10:00:00.000Z"))).toBeInstanceOf(
      UniqueConstraintError,
    )
    expect(await repository.create(openRecord(2, "2026-03-15T09:05:00.000Z"))).toBeInstanceOf(
      AttendanceRecord,
    )

    const closed = first.withClosed({
      clockOutAt: "2026-03-15T18:00:00.000Z",
      workMinutes: 540,
      note: "left early",
    })

    const updated = await repository.update(closed)

    if (updated === null || updated instanceof Error) throw new Error("close failed")

    expect(updated.status).toBe("closed")
    expect(updated.workMinutes).toBe(540)
    expect(updated.note).toBe("left early")

    expect(await repository.update(closed)).toBe(null)
    expect(await repository.findOpenByEmployeeId(toWorkforceEmployeeId(testEmployeeId(1)))).toBe(
      null,
    )

    const next = await repository.create(openRecord(1, "2026-03-16T09:00:00.000Z"))

    expect(next).toBeInstanceOf(AttendanceRecord)
  })
})

describe("AttendanceRecordRepository", () => {
  test("create then findOpenByEmployeeId round-trips the record", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findopenbyemployeeid-round-trips",
    )

    const repository = new AttendanceRecordRepository(context)

    const created = await repository.create(
      AttendanceRecord.create({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        clockInAt: "2026-01-01T09:00:00.000Z",
        note: "出勤",
      }),
    )

    expect(created).toBeInstanceOf(AttendanceRecord)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findOpenByEmployeeId(toWorkforceEmployeeId(testEmployeeId(1)))

    expect(found).toBeInstanceOf(AttendanceRecord)

    if (found instanceof Error || found === null) {
      throw new Error("findOpenByEmployeeId failed")
    }

    expect(found.id).toBe(created.id)
    expect(found.status).toBe("open")
  })
})
