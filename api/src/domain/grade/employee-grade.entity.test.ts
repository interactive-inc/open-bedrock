import { EmployeeGrade } from "@/domain/grade/employee-grade.entity"
import { describe, expect, test } from "bun:test"

describe("EmployeeGrade.create", () => {
  test("builds an unsaved assignment with null id", () => {
    const assignment = EmployeeGrade.create({
      employeeId: 5,
      gradeId: 2,
      effectiveDate: "2026-04-01",
      reason: "Promotion",
      createdAt: "2026-04-01T00:00:00.000Z",
    })

    expect(assignment).toBeInstanceOf(EmployeeGrade)
    expect(assignment.id).toBe(null)
    expect(assignment.employeeId).toBe(5)
    expect(assignment.gradeId).toBe(2)
    expect(assignment.effectiveDate).toBe("2026-04-01")
    expect(assignment.reason).toBe("Promotion")
  })
})
