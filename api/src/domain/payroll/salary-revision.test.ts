import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { describe, expect, test } from "bun:test"

describe("SalaryRevision.create", () => {
  test("builds with null id", () => {
    const revision = SalaryRevision.create({
      employeeId: 1,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
      reason: "Annual raise",
      createdAt: "2026-03-15T00:00:00.000Z",
    })

    expect(revision).toBeInstanceOf(SalaryRevision)
    expect(revision.id).toBe(null)
    expect(revision.newBaseSalary).toBe(320000)
  })
})

describe("SalaryRevision.withNewBaseSalary", () => {
  test("returns new with changed salary", () => {
    const revision = SalaryRevision.create({
      employeeId: 1,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
      reason: null,
      createdAt: "2026-03-15T00:00:00.000Z",
    })

    const updated = revision.withNewBaseSalary(350000)

    expect(updated.newBaseSalary).toBe(350000)
    expect(updated.previousBaseSalary).toBe(300000)
  })
})

describe("SalaryRevision.withEffectiveDate", () => {
  test("returns new with changed date", () => {
    const revision = SalaryRevision.create({
      employeeId: 1,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
      reason: null,
      createdAt: "2026-03-15T00:00:00.000Z",
    })

    const updated = revision.withEffectiveDate("2026-05-01")

    expect(updated.effectiveDate).toBe("2026-05-01")
  })
})

describe("SalaryRevision.withReason", () => {
  test("returns new with changed reason", () => {
    const revision = SalaryRevision.create({
      employeeId: 1,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
      reason: null,
      createdAt: "2026-03-15T00:00:00.000Z",
    })

    const updated = revision.withReason("Promotion")

    expect(updated.reason).toBe("Promotion")
  })
})
