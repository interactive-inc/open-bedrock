import { Expense } from "@/domain/expense/expense.entity"
import { DeleteExpense } from "@/application/expense/delete-expense"
import { UpdateExpense } from "@/application/expense/update-expense"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"
import type { Context } from "@/env"

async function seedPending(context: Context, employeeId: number): Promise<number> {
  const repository = new ExpenseRepository(context)

  const created = await repository.create(
    Expense.create({
      employeeId: employeeId,
      category: "transport",
      amount: 1200,
      spentAt: "2026-01-01",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("UpdateExpense", () => {
  test("updates the pending expense for the owner", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: 5,
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: "updated",
    })

    expect(result).toBeInstanceOf(Expense)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.category).toBe("supplies")
    expect(result.amount).toBe(4500)
    expect(result.note).toBe("updated")
  })

  test("rejects a non owner with not_owner", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: 9,
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expect(result).toEqual({ reason: "not_owner" })
  })

  test("rejects an unknown id with expense_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateExpense(context).run({
      expenseId: 9999,
      employeeId: 5,
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expect(result).toEqual({ reason: "expense_not_found" })
  })

  test("rejects a non pending expense with not_editable", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const repository = new ExpenseRepository(context)

    const current = await repository.findById(expenseId)

    if (current instanceof Error || current === null) {
      throw new Error("setup failed")
    }

    await repository.update(current.withStatus("approved"))

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: 5,
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expect(result).toEqual({ reason: "not_editable" })
  })
})

describe("DeleteExpense", () => {
  test("deletes the pending expense for the owner", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const result = await new DeleteExpense(context).run({
      expenseId: expenseId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "deleted" })

    const repository = new ExpenseRepository(context)

    const found = await repository.findById(expenseId)

    expect(found).toBeNull()
  })

  test("rejects a non owner with not_owner", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const result = await new DeleteExpense(context).run({
      expenseId: expenseId,
      employeeId: 9,
    })

    expect(result).toEqual({ reason: "not_owner" })
  })

  test("rejects an unknown id with expense_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteExpense(context).run({
      expenseId: 9999,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "expense_not_found" })
  })

  test("rejects a non pending expense with not_deletable", async () => {
    const { context } = createTestContext()

    const expenseId = await seedPending(context, 5)

    const repository = new ExpenseRepository(context)

    const current = await repository.findById(expenseId)

    if (current instanceof Error || current === null) {
      throw new Error("setup failed")
    }

    await repository.update(current.withStatus("settled"))

    const result = await new DeleteExpense(context).run({
      expenseId: expenseId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "not_deletable" })
  })
})
