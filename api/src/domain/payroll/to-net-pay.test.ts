import { toNetPay } from "@/domain/payroll/to-net-pay"
import { describe, expect, test } from "bun:test"

describe("toNetPay", () => {
  test("calculates baseSalary + allowances - deductions", () => {
    expect(toNetPay({ baseSalary: 300000, allowances: 50000, deductions: 80000 })).toBe(270000)
  })

  test("handles zero deductions", () => {
    expect(toNetPay({ baseSalary: 300000, allowances: 50000, deductions: 0 })).toBe(350000)
  })

  test("handles zero allowances", () => {
    expect(toNetPay({ baseSalary: 300000, allowances: 0, deductions: 80000 })).toBe(220000)
  })

  test("handles all zeros", () => {
    expect(toNetPay({ baseSalary: 0, allowances: 0, deductions: 0 })).toBe(0)
  })
})
