import { SalaryRevision } from "@/domain/payroll/salary-revision"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("SalaryRevisionRepository", () => {
  test("create then findById round-trips the revision", async () => {
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

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(SalaryRevision)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.newBaseSalary).toBe(330000)
    expect(found.effectiveDate).toBe("2026-04-01")
  })

  test("findById returns null when none exist", async () => {
    const { context } = createTestContext()

    const repository = new SalaryRevisionRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })

  test("findLatestBeforeDate ignores revisions effective on or after the target date", async () => {
    const { context } = createTestContext()

    const repository = new SalaryRevisionRepository(context)

    await repository.create(
      SalaryRevision.create({
        employeeId: 1,
        effectiveDate: "2026-04-01",
        previousBaseSalary: 300000,
        newBaseSalary: 320000,
        reason: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    await repository.create(
      SalaryRevision.create({
        employeeId: 1,
        effectiveDate: "2026-06-01",
        previousBaseSalary: 320000,
        newBaseSalary: 340000,
        reason: null,
        createdAt: "2026-05-01T00:00:00.000Z",
      }),
    )

    // バックデート（2026-05-01）の直前は 2026-06-01 ではなく 2026-04-01。
    const found = await repository.findLatestBeforeDate(1, "2026-05-01")

    if (found instanceof Error || found === null) {
      throw new Error("findLatestBeforeDate failed")
    }

    expect(found.effectiveDate).toBe("2026-04-01")
    expect(found.newBaseSalary).toBe(320000)
  })

  test("findLatestBeforeDate returns null when no revision precedes the date", async () => {
    const { context } = createTestContext()

    const repository = new SalaryRevisionRepository(context)

    await repository.create(
      SalaryRevision.create({
        employeeId: 1,
        effectiveDate: "2026-04-01",
        previousBaseSalary: 300000,
        newBaseSalary: 320000,
        reason: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    // 同日（2026-04-01）は「直前」に含めない。
    const found = await repository.findLatestBeforeDate(1, "2026-04-01")

    expect(found).toBeNull()
  })
})
