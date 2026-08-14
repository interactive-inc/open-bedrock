import { EmployeeEvent } from "@/domain/employee-event/employee-event.entity"
import { describe, expect, test } from "bun:test"

describe("EmployeeEvent.create", () => {
  test("builds an unsaved event with null id", () => {
    const event = EmployeeEvent.create({
      employeeId: 5,
      kind: "transfer",
      effectiveDate: "2025-10-01",
      fromDepartmentCode: "D003",
      toDepartmentCode: "D004",
      note: "Team change",
      createdAt: "2025-10-01T00:00:00.000Z",
    })

    expect(event).toBeInstanceOf(EmployeeEvent)
    expect(event.id).toBe(null)
    expect(event.kind).toBe("transfer")
    expect(event.fromDepartmentCode).toBe("D003")
    expect(event.toDepartmentCode).toBe("D004")
  })
})

describe("EmployeeEvent.fromRow", () => {
  test("rejects an unknown kind", () => {
    expect(() =>
      EmployeeEvent.fromRow({
        id: 1,
        employeeId: 5,
        kind: "promotion",
        effectiveDate: "2025-10-01",
        fromDepartmentCode: null,
        toDepartmentCode: null,
        note: null,
        createdAt: "2025-10-01T00:00:00.000Z",
      }),
    ).toThrow()
  })
})
