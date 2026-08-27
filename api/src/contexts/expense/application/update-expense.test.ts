import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import { UpdateExpense } from "@/contexts/expense/application/update-expense"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/repositories/expense.repository"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"
import type { Context } from "@/env"

async function seedPending(context: Context, employeeId: number): Promise<number> {
  const repository = new ExpenseRepository(context)

  const created = await repository.create(
    Expense.create({
      employeeId: toWorkforceEmployeeId(employeeId),
      organizationUnitId: toWorkforceOrganizationUnitId("D003"),
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
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const expenseId = await seedPending(context, 5)

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: toWorkforceEmployeeId(5),
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: "updated",
    })

    expect(result).toBeInstanceOf(Expense)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.category).toBe("supplies")
    expect(result.amount).toBe(4500)
    expect(result.note).toBe("updated")
  })

  test("rejects a non owner with not_owner", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const expenseId = await seedPending(context, 5)

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: toWorkforceEmployeeId(9),
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expectApplicationError(result, ForbiddenError, "not_owner")
  })

  test("rejects an unknown id with expense_not_found", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const result = await new UpdateExpense(context).run({
      expenseId: 9999,
      employeeId: toWorkforceEmployeeId(5),
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expectApplicationError(result, NotFoundError, "expense_not_found")
  })

  test("rejects a non pending expense with not_editable", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const expenseId = await seedPending(context, 5)

    const repository = new ExpenseRepository(context)

    const current = await repository.findById(expenseId)

    if (current instanceof Error || current === null) {
      throw new Error("setup failed")
    }

    await repository.update(current.withStatus("approved"))

    const result = await new UpdateExpense(context).run({
      expenseId: expenseId,
      employeeId: toWorkforceEmployeeId(5),
      category: "supplies",
      amount: 4500,
      spentAt: "2026-02-02",
      note: null,
    })

    expectApplicationError(result, ConflictError, "not_editable")
  })
})

describe("DeleteExpense", () => {})
