import { Payslip } from "@/domain/payroll/payslip"
import { describe, expect, test } from "bun:test"

describe("Payslip.create", () => {
  test("builds with null id and issued status", () => {
    const payslip = Payslip.create({
      employeeId: 1,
      period: "2026-01",
      baseSalary: 300000,
      allowances: 50000,
      deductions: 80000,
      netPay: 270000,
      issuedAt: "2026-01-25T00:00:00.000Z",
    })

    expect(payslip).toBeInstanceOf(Payslip)
    expect(payslip.id).toBe(null)
    expect(payslip.status).toBe("issued")
    expect(payslip.baseSalary).toBe(300000)
  })
})

describe("Payslip.withCorrected", () => {
  test("returns new with changed amounts", () => {
    const payslip = Payslip.create({
      employeeId: 1,
      period: "2026-01",
      baseSalary: 300000,
      allowances: 50000,
      deductions: 80000,
      netPay: 270000,
      issuedAt: "2026-01-25T00:00:00.000Z",
    })

    const corrected = payslip.withCorrected({
      period: "2026-02",
      baseSalary: 310000,
      allowances: 55000,
      deductions: 85000,
      netPay: 280000,
    })

    expect(corrected.period).toBe("2026-02")
    expect(corrected.baseSalary).toBe(310000)
    expect(corrected.netPay).toBe(280000)
    expect(corrected.employeeId).toBe(1)
  })
})
