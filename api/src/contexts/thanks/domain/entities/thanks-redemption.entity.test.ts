import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { describe, expect, test } from "bun:test"

describe("ThanksRedemption.create", () => {
  test("builds with null id, pending status, null decidedAt and deciderId", () => {
    const redemption = ThanksRedemption.create({
      employeeId: toWorkforceEmployeeId(1),
      rewardId: 10,
      pointCost: 200,
      createdAt: "2026-01-15T00:00:00.000Z",
    })

    expect(redemption).toBeInstanceOf(ThanksRedemption)
    expect(redemption.id).toBe(null)
    expect(redemption.status).toBe("pending")
    expect(redemption.decidedAt).toBe(null)
    expect(redemption.deciderId).toBe(null)
  })
})
