import { AttendanceRecord } from "@/domain/attendance/attendance-record.entity"
import { AttendanceRecordRepository } from "@/infrastructure/attendance/attendance-record-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("AttendanceRecordRepository", () => {
  test("create then findOpenByEmployeeId round-trips the record", async () => {
    const { context } = createTestContext()

    const repository = new AttendanceRecordRepository(context)

    const created = await repository.create(
      AttendanceRecord.create({
        employeeId: 1,
        clockInAt: "2026-01-01T09:00:00.000Z",
        note: "出勤",
      }),
    )

    expect(created).toBeInstanceOf(AttendanceRecord)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findOpenByEmployeeId(1)

    expect(found).toBeInstanceOf(AttendanceRecord)

    if (found instanceof Error || found === null) {
      throw new Error("findOpenByEmployeeId failed")
    }

    expect(found.id).toBe(created.id)
    expect(found.status).toBe("open")
  })
})
