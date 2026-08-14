import { LeaveBalanceRepository } from "@/contexts/company/infrastructure/leave/leave-balance-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { LeaveBalance } from "@/contexts/company/domain/leave/leave-balance.entity"
import { describe, expect, test } from "bun:test"

describe("LeaveBalanceRepository", () => {
  test("findByKey returns the seeded balance", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "leave_balances", [
      {
        employee_id: 1,
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 5,
        remaining_days: 15,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const found = await repository.findByKey({
      employeeId: 1,
      fiscalYear: "2026",
      leaveType: "annual",
    })

    expect(found).toBeInstanceOf(LeaveBalance)

    if (found instanceof Error || found === null) {
      throw new Error("findByKey failed")
    }

    expect(found.grantedDays).toBe(20)
    expect(found.remainingDays).toBe(15)
  })

  test("consumeDays atomically decrements the balance", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "leave_balances", [
      {
        employee_id: 1,
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 5,
        remaining_days: 15,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const outcome = await repository.consumeDays({
      employeeId: 1,
      leaveType: "annual",
      fiscalYear: "2026",
      days: 2,
    })

    expect(outcome).toBe("consumed")

    const after = await repository.findByKey({
      employeeId: 1,
      fiscalYear: "2026",
      leaveType: "annual",
    })

    if (after instanceof Error || after === null) {
      throw new Error("findByKey failed")
    }

    expect(after.usedDays).toBe(7)
    expect(after.remainingDays).toBe(13)
  })

  test("consumeDays returns insufficient when remaining_days < days", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "leave_balances", [
      {
        employee_id: 1,
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 18,
        remaining_days: 2,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const outcome = await repository.consumeDays({
      employeeId: 1,
      leaveType: "annual",
      fiscalYear: "2026",
      days: 3,
    })

    expect(outcome).toBe("insufficient")

    // Balance should remain unchanged
    const after = await repository.findByKey({
      employeeId: 1,
      fiscalYear: "2026",
      leaveType: "annual",
    })

    if (after instanceof Error || after === null) {
      throw new Error("findByKey failed")
    }

    expect(after.usedDays).toBe(18)
    expect(after.remainingDays).toBe(2)
  })
})
