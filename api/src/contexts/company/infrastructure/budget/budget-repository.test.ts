import { Budget } from "@/contexts/company/domain/budget/budget.entity"
import { BudgetRepository } from "@/contexts/company/infrastructure/budget/budget-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"

function budget(props: { departmentId: number; periodStart: string; periodEnd: string }): Budget {
  return Budget.create({
    departmentId: props.departmentId,
    fiscalPeriod: "2026",
    periodStart: props.periodStart,
    periodEnd: props.periodEnd,
    amount: 1_000_000,
    name: "FY2026",
    note: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  })
}

describe("BudgetRepository", () => {
  test("create then findById round-trips the budget", async () => {
    const { context } = createTestContext()

    const repository = new BudgetRepository(context)

    const created = await repository.create(
      budget({ departmentId: 3, periodStart: "2026-04-01", periodEnd: "2027-03-31" }),
    )

    expect(created).toBeInstanceOf(Budget)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.departmentId).toBe(3)
    expect(found.amount).toBe(1_000_000)
  })

  test("update persists amount, name and note without touching department or period", async () => {
    const { context } = createTestContext()

    const repository = new BudgetRepository(context)

    const created = await repository.create(
      budget({ departmentId: 3, periodStart: "2026-04-01", periodEnd: "2027-03-31" }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(
      created.withDetails({ amount: 2_000_000, name: "revised", note: "raised" }),
    )

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.amount).toBe(2_000_000)
    expect(updated.name).toBe("revised")
    expect(updated.note).toBe("raised")
    expect(updated.departmentId).toBe(3)
    expect(updated.periodStart).toBe("2026-04-01")
  })

  test("delete removes the budget and returns null when missing", async () => {
    const { context } = createTestContext()

    const repository = new BudgetRepository(context)

    const created = await repository.create(
      budget({ departmentId: 3, periodStart: "2026-04-01", periodEnd: "2027-03-31" }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    expect(await repository.delete(created.id)).toBe(true)
    expect(await repository.delete(created.id)).toBeNull()
  })

  test("sumApprovedExpenses sums only approved expenses of the department within the period", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "employees", [
      {
        id: 1,
        code: "E001",
        name: "Eng A",
        dept_id: 3,
        dept_name: "Engineering",
        position: null,
        status: "active",
      },
      {
        id: 2,
        code: "E002",
        name: "Sales A",
        dept_id: 4,
        dept_name: "Sales",
        position: null,
        status: "active",
      },
    ])

    await seedD1(db, "expenses", [
      // 対象: dept 3, approved, 期間内
      {
        id: 1,
        employee_id: 1,
        category: "books",
        amount: 3300,
        spent_at: "2026-05-12",
        note: null,
        status: "approved",
        created_at: "2026-05-13T00:00:00Z",
      },
      // 除外: pending
      {
        id: 2,
        employee_id: 1,
        category: "transport",
        amount: 1200,
        spent_at: "2026-05-10",
        note: null,
        status: "pending",
        created_at: "2026-05-11T00:00:00Z",
      },
      // 除外: 別部署
      {
        id: 3,
        employee_id: 2,
        category: "other",
        amount: 5000,
        spent_at: "2026-05-14",
        note: null,
        status: "approved",
        created_at: "2026-05-15T00:00:00Z",
      },
      // 除外: 期間外
      {
        id: 4,
        employee_id: 1,
        category: "other",
        amount: 9999,
        spent_at: "2027-05-01",
        note: null,
        status: "approved",
        created_at: "2027-05-01T00:00:00Z",
      },
    ])

    const repository = new BudgetRepository(context)

    const total = await repository.sumApprovedExpenses({
      departmentId: 3,
      periodStart: "2026-04-01",
      periodEnd: "2027-03-31",
    })

    expect(total).toBe(3300)
  })

  test("sumApprovedExpenses returns 0 when nothing matches", async () => {
    const { context } = createTestContext()

    const repository = new BudgetRepository(context)

    const total = await repository.sumApprovedExpenses({
      departmentId: 99,
      periodStart: "2026-04-01",
      periodEnd: "2027-03-31",
    })

    expect(total).toBe(0)
  })
})
