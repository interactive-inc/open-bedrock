import { Payslip } from "@/domain/payroll/payslip.entity"
import { describe, expect, test } from "bun:test"

describe("Payslip.toNetPay", () => {
  test("calculates baseSalary + allowances - deductions", () => {
    expect(Payslip.toNetPay({ baseSalary: 300000, allowances: 50000, deductions: 80000 })).toBe(
      270000,
    )
  })

  test("handles zero deductions", () => {
    expect(Payslip.toNetPay({ baseSalary: 300000, allowances: 50000, deductions: 0 })).toBe(350000)
  })

  test("handles zero allowances", () => {
    expect(Payslip.toNetPay({ baseSalary: 300000, allowances: 0, deductions: 80000 })).toBe(220000)
  })

  test("handles all zeros", () => {
    expect(Payslip.toNetPay({ baseSalary: 0, allowances: 0, deductions: 0 })).toBe(0)
  })
})

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
