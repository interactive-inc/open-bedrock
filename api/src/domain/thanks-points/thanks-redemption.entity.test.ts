import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import { describe, expect, test } from "bun:test"

describe("ThanksRedemption.create", () => {
  test("builds with null id, pending status, null decidedAt and deciderId", () => {
    const redemption = ThanksRedemption.create({
      employeeId: 1,
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
