import { Payslip } from "@/domain/payroll/payslip"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"
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
})
