import { Budget } from "@/contexts/expense/domain/budget/budget.entity"
import { describe, expect, test } from "bun:test"

describe("Budget.create", () => {
  test("builds a Budget with null id", () => {
    const budget = Budget.create({
      departmentId: 3,
      fiscalPeriod: "2026",
      periodStart: "2026-04-01",
      periodEnd: "2027-03-31",
      amount: 1_000_000,
      name: "Engineering FY2026",
      note: "annual",
      createdAt: "2026-04-01T09:00:00.000Z",
    })

    expect(budget).toBeInstanceOf(Budget)
    expect(budget.id).toBeNull()
    expect(budget.departmentId).toBe(3)
    expect(budget.fiscalPeriod).toBe("2026")
    expect(budget.periodStart).toBe("2026-04-01")
    expect(budget.periodEnd).toBe("2027-03-31")
    expect(budget.amount).toBe(1_000_000)
    expect(budget.name).toBe("Engineering FY2026")
    expect(budget.note).toBe("annual")
  })

  test("accepts null note", () => {
    const budget = Budget.create({
      departmentId: 4,
      fiscalPeriod: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      amount: 50_000,
      name: "Sales May",
      note: null,
      createdAt: "2026-05-01T09:00:00.000Z",
    })

    expect(budget.note).toBeNull()
  })
})

describe("Budget.withDetails", () => {
  test("returns a new Budget with the changed amount, name and note", () => {
    const budget = Budget.create({
      departmentId: 3,
      fiscalPeriod: "2026",
      periodStart: "2026-04-01",
      periodEnd: "2027-03-31",
      amount: 1_000_000,
      name: "Engineering FY2026",
      note: "annual",
      createdAt: "2026-04-01T09:00:00.000Z",
    })

    const revised = budget.withDetails({
      amount: 1_200_000,
      name: "Engineering FY2026 (revised)",
      note: null,
    })

    expect(revised).toBeInstanceOf(Budget)
    expect(revised.amount).toBe(1_200_000)
    expect(revised.name).toBe("Engineering FY2026 (revised)")
    expect(revised.note).toBeNull()
    expect(revised.departmentId).toBe(3)
    expect(revised.fiscalPeriod).toBe("2026")
    expect(revised.periodStart).toBe("2026-04-01")
  })
})
