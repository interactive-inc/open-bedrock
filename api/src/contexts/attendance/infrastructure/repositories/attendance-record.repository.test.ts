import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("AttendanceRecordRepository", () => {
  test("create then findOpenByEmployeeId round-trips the record", async () => {
    const { context } = await createTestContext()

    const repository = new AttendanceRecordRepository(context)

    const created = await repository.create(
      AttendanceRecord.create({
        employeeId: toWorkforceEmployeeId(1),
        clockInAt: "2026-01-01T09:00:00.000Z",
        note: "出勤",
      }),
    )

    expect(created).toBeInstanceOf(AttendanceRecord)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findOpenByEmployeeId(toWorkforceEmployeeId(1))

    expect(found).toBeInstanceOf(AttendanceRecord)

    if (found instanceof Error || found === null) {
      throw new Error("findOpenByEmployeeId failed")
    }

    expect(found.id).toBe(created.id)
    expect(found.status).toBe("open")
  })
})
