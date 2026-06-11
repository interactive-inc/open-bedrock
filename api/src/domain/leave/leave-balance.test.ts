import { LeaveBalance } from "@/domain/leave/leave-balance"
import { describe, expect, test } from "bun:test"

describe("LeaveBalance.decrement", () => {
  test("returns a new balance with updated used and remaining days", () => {
    const balance = LeaveBalance.fromRow({
      employeeId: 7,
      fiscalYear: "2026",
      leaveType: "annual",
      grantedDays: 20,
      usedDays: 5,
      remainingDays: 15,
    })

    const decremented = balance.decrement(3)

    expect(decremented).toBeInstanceOf(LeaveBalance)

    if (!(decremented instanceof LeaveBalance)) {
      throw new Error("expected LeaveBalance")
    }

    expect(decremented.usedDays).toBe(8)
    expect(decremented.remainingDays).toBe(12)
    expect(decremented.employeeId).toBe(7)
    expect(decremented.grantedDays).toBe(20)
  })

  test("decrementing all remaining days succeeds", () => {
    const balance = LeaveBalance.fromRow({
      employeeId: 7,
      fiscalYear: "2026",
      leaveType: "annual",
      grantedDays: 10,
      usedDays: 8,
      remainingDays: 2,
    })

    const decremented = balance.decrement(2)

    expect(decremented).toBeInstanceOf(LeaveBalance)

    if (!(decremented instanceof LeaveBalance)) {
      throw new Error("expected LeaveBalance")
    }

    expect(decremented.usedDays).toBe(10)
    expect(decremented.remainingDays).toBe(0)
  })

  test("decrement with 0 returns invalid_decrement", () => {
    const balance = LeaveBalance.fromRow({
      employeeId: 7,
      fiscalYear: "2026",
      leaveType: "annual",
      grantedDays: 20,
      usedDays: 5,
      remainingDays: 15,
    })

    const failure = balance.decrement(0)

    expect(failure).not.toBeInstanceOf(LeaveBalance)
    expect(failure).toEqual({ reason: "invalid_decrement" })
  })

  test("decrement with negative returns invalid_decrement", () => {
    const balance = LeaveBalance.fromRow({
      employeeId: 7,
      fiscalYear: "2026",
      leaveType: "annual",
      grantedDays: 20,
      usedDays: 5,
      remainingDays: 15,
    })

    const failure = balance.decrement(-3)

    expect(failure).not.toBeInstanceOf(LeaveBalance)
    expect(failure).toEqual({ reason: "invalid_decrement" })
  })

  test("decrement more than remaining returns invalid_decrement", () => {
    const balance = LeaveBalance.fromRow({
      employeeId: 7,
      fiscalYear: "2026",
      leaveType: "annual",
      grantedDays: 10,
      usedDays: 8,
      remainingDays: 2,
    })

    const failure = balance.decrement(5)

    expect(failure).not.toBeInstanceOf(LeaveBalance)
    expect(failure).toEqual({ reason: "invalid_decrement" })
  })
})
