import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("SalaryRevisionRepository", () => {
  test("create then findLatestByEmployeeId round-trips the revision", async () => {
    const { context } = createTestContext()

    const repository = new SalaryRevisionRepository(context)

    const created = await repository.create(
      SalaryRevision.create({
        employeeId: 1,
        effectiveDate: "2026-04-01",
        previousBaseSalary: 300000,
        newBaseSalary: 330000,
        reason: "昇給",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(SalaryRevision)

    if (created instanceof Error) {
      throw created
    }

    const found = await repository.findLatestByEmployeeId(1)

    expect(found).toBeInstanceOf(SalaryRevision)

    if (found instanceof Error || found === null) {
      throw new Error("findLatestByEmployeeId failed")
    }

    expect(found.newBaseSalary).toBe(330000)
    expect(found.effectiveDate).toBe("2026-04-01")
  })

  test("findLatestByEmployeeId returns null when none exist", async () => {
    const { context } = createTestContext()

    const repository = new SalaryRevisionRepository(context)

    const found = await repository.findLatestByEmployeeId(9999)

    expect(found).toBeNull()
  })
})
