import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { toPreviousBaseSalary } from "@/domain/payroll/to-previous-base-salary"
import { describe, expect, test } from "bun:test"

describe("toPreviousBaseSalary", () => {
  test("returns the prior revision's new base salary", () => {
    const priorRevision = SalaryRevision.create({
      employeeId: 5,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
      reason: "annual_raise",
      createdAt: "2026-03-01T00:00:00.000Z",
    })

    expect(toPreviousBaseSalary({ priorRevision })).toBe(320000)
  })

  test("returns 0 when there is no prior revision", () => {
    expect(toPreviousBaseSalary({ priorRevision: null })).toBe(0)
  })
})
