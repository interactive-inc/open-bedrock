import { Payslip } from "@/domain/payroll/payslip.entity"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("PayslipRepository", () => {
  test("create persists the payslip and returns it with an id", async () => {
    const { context } = createTestContext()

    const repository = new PayslipRepository(context)

    const created = await repository.create(
      Payslip.create({
        employeeId: 1,
        period: "2026-01",
        baseSalary: 300000,
        allowances: 20000,
        deductions: 50000,
        netPay: 270000,
        issuedAt: "2026-01-25T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(Payslip)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    expect(created.period).toBe("2026-01")
    expect(created.netPay).toBe(270000)
    expect(created.status).toBe("issued")
  })

  test("findByEmployeeAndPeriod returns the matching payslip", async () => {
    const { context } = createTestContext()

    const repository = new PayslipRepository(context)

    await repository.create(
      Payslip.create({
        employeeId: 1,
        period: "2026-02",
        baseSalary: 300000,
        allowances: 0,
        deductions: 0,
        netPay: 300000,
        issuedAt: "2026-02-25T00:00:00.000Z",
      }),
    )

    const found = await repository.findByEmployeeAndPeriod(1, "2026-02")

    if (found instanceof Error || found === null) {
      throw new Error("findByEmployeeAndPeriod failed")
    }

    expect(found.employeeId).toBe(1)
    expect(found.period).toBe("2026-02")
  })

  test("findByEmployeeAndPeriod returns null when none match", async () => {
    const { context } = createTestContext()

    const repository = new PayslipRepository(context)

    const found = await repository.findByEmployeeAndPeriod(1, "2099-12")

    expect(found).toBeNull()
  })

  test("create returns a UniqueConstraintError on a duplicate employee and period", async () => {
    const { context } = createTestContext()

    const repository = new PayslipRepository(context)

    const first = await repository.create(
      Payslip.create({
        employeeId: 1,
        period: "2026-03",
        baseSalary: 300000,
        allowances: 0,
        deductions: 0,
        netPay: 300000,
        issuedAt: "2026-03-25T00:00:00.000Z",
      }),
    )

    expect(first).toBeInstanceOf(Payslip)

    const second = await repository.create(
      Payslip.create({
        employeeId: 1,
        period: "2026-03",
        baseSalary: 310000,
        allowances: 0,
        deductions: 0,
        netPay: 310000,
        issuedAt: "2026-03-26T00:00:00.000Z",
      }),
    )

    expect(second).toBeInstanceOf(UniqueConstraintError)
  })
})
