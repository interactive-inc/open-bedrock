import { Expense } from "@/contexts/expense/domain/expense.entity"
import { ExpenseApproval } from "@/contexts/expense/domain/expense-approval.entity"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/expense-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ExpenseRepository", () => {
  test("create then findById round-trips the expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: "テスト経費",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(Expense)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(Expense)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.amount).toBe(1200)
    expect(found.status).toBe("pending")
  })

  test("update persists the status change", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(created.withStatus("approved"))

    expect(updated).toBeInstanceOf(Expense)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("approved")
  })

  test("update returns null and does not modify a non-pending expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    // first promote to approved via the pending guard
    const approved = await repository.update(created.withStatus("approved"))

    if (approved instanceof Error || approved === null) {
      throw new Error("setup failed: could not approve")
    }

    // now attempt to update the approved expense — should return null
    const result = await repository.update(
      approved.withDetails({
        category: "supplies",
        amount: 9999,
        spentAt: "2026-06-01",
        note: null,
      }),
    )

    expect(result).toBeNull()

    // confirm the DB was not modified
    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.amount).toBe(1200)
    expect(found.status).toBe("approved")
  })

  test("delete returns null and does not remove a non-pending expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    // promote to approved so the pending guard blocks deletion
    const approved = await repository.update(created.withStatus("approved"))

    if (approved instanceof Error || approved === null) {
      throw new Error("setup failed: could not approve")
    }

    // attempt to delete the approved expense — should return null
    const result = await repository.delete(created.id)

    expect(result).toBeNull()

    // confirm the row was not removed
    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.status).toBe("approved")
  })

  test("decideFromPending flips a pending expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const decided = await repository.decideFromPending({
      expenseId: created.id,
      status: "approved",
    })

    expect(decided).toBeInstanceOf(Expense)

    if (decided instanceof Error || decided === null) {
      throw new Error("decideFromPending failed")
    }

    expect(decided.status).toBe("approved")
  })

  test("decideFromPending returns null for an already decided expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    await repository.decideFromPending({ expenseId: created.id, status: "approved" })

    const second = await repository.decideFromPending({ expenseId: created.id, status: "rejected" })

    expect(second).toBeNull()

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.status).toBe("approved")
  })

  test("decideFromPending returns null for a settled expense and keeps it settled", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const created = await repository.create(
      Expense.create({
        employeeId: 1,
        category: "transport",
        amount: 1200,
        spentAt: "2026-01-01",
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    await repository.update(created.withStatus("settled"))

    const decided = await repository.decideFromPending({
      expenseId: created.id,
      status: "approved",
    })

    expect(decided).toBeNull()

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.status).toBe("settled")
  })

  test("decideFromPending returns null for an unknown expense id", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const decided = await repository.decideFromPending({ expenseId: 99999, status: "approved" })

    expect(decided).toBeNull()
  })

  test("addApproval persists an approval record for the expense", async () => {
    const { context } = createTestContext()

    const repository = new ExpenseRepository(context)

    const approval = await repository.addApproval(
      ExpenseApproval.create({
        expenseId: 1,
        approverId: 2,
        action: "approve",
        comment: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(approval).toBeInstanceOf(ExpenseApproval)

    if (approval instanceof Error) {
      throw approval
    }

    expect(approval.action).toBe("approve")
  })
})
