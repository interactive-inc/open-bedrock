import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { LeaveBalanceRepository } from "@/contexts/leave/infrastructure/repositories/leave-balance.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { LeaveBalance } from "@/contexts/leave/domain/entities/leave-balance.entity"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "findbykey-returns-the-seeded-balance",
      "consumedays-atomically-decrements-the-balance",
      "consumedays-returns-insufficient-when",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("LeaveBalanceRepository", () => {
  test("findByKey returns the seeded balance", async () => {
    const { context, db } = await createLocalD1Context(
      local,
      "findbykey-returns-the-seeded-balance",
    )

    await seedD1(db, "leave_balances", [
      {
        id: crypto.randomUUID(),
        employee_id: testEmployeeId(1),
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 5,
        remaining_days: 15,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const found = await repository.findByKey({
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
    const { context, db } = await createLocalD1Context(
      local,
      "consumedays-atomically-decrements-the-balance",
    )

    await seedD1(db, "leave_balances", [
      {
        id: crypto.randomUUID(),
        employee_id: testEmployeeId(1),
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 5,
        remaining_days: 15,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const outcome = await repository.consumeDays({
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      leaveType: "annual",
      fiscalYear: "2026",
      days: 2,
    })

    expect(outcome).toBe("consumed")

    const after = await repository.findByKey({
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
    const { context, db } = await createLocalD1Context(
      local,
      "consumedays-returns-insufficient-when",
    )

    await seedD1(db, "leave_balances", [
      {
        id: crypto.randomUUID(),
        employee_id: testEmployeeId(1),
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 18,
        remaining_days: 2,
      },
    ])

    const repository = new LeaveBalanceRepository(context)

    const outcome = await repository.consumeDays({
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      leaveType: "annual",
      fiscalYear: "2026",
      days: 3,
    })

    expect(outcome).toBe("insufficient")

    // Balance should remain unchanged
    const after = await repository.findByKey({
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
