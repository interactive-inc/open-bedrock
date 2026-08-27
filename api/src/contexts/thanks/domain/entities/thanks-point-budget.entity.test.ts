import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ThanksPointBudget } from "@/contexts/thanks/domain/entities/thanks-point-budget.entity"
import { describe, expect, test } from "bun:test"

describe("ThanksPointBudget.create", () => {
  test("builds with null id and 0 consumedPoints", () => {
    const budget = ThanksPointBudget.create({
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-01",
      grantedPoints: 400,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(budget).toBeInstanceOf(ThanksPointBudget)
    expect(budget.id).toBe(null)
    expect(budget.consumedPoints).toBe(0)
    expect(budget.grantedPoints).toBe(400)
  })
})

describe("ThanksPointBudget.remainingPoints", () => {
  test("returns granted minus consumed", () => {
    const budget = new ThanksPointBudget({
      id: 1,
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-01",
      grantedPoints: 400,
      consumedPoints: 150,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(budget.remainingPoints).toBe(250)
  })

  test("returns 0 when consumed exceeds granted", () => {
    const budget = new ThanksPointBudget({
      id: 1,
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-01",
      grantedPoints: 100,
      consumedPoints: 200,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(budget.remainingPoints).toBe(0)
  })
})
