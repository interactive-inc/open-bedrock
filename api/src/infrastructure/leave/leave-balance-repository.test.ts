import { LeaveBalanceRepository } from "@/infrastructure/leave/leave-balance-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { LeaveBalance } from "@/domain/leave/leave-balance"
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

  test("update persists the decremented balance", async () => {
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

    if (found instanceof Error || found === null) {
      throw new Error("findByKey failed")
    }

    const updated = await repository.update(found.decrement(2))

    expect(updated).toBeInstanceOf(LeaveBalance)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.usedDays).toBe(7)
    expect(updated.remainingDays).toBe(13)
  })
})
