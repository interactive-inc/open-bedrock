import { Expense } from "@/contexts/expense/domain/expense.entity"
import { describe, expect, test } from "bun:test"

describe("Expense.create", () => {
  test("builds an Expense with pending status and null id", () => {
    const expense = Expense.create({
      employeeId: 5,
      category: "transport",
      amount: 1200,
      spentAt: "2026-06-01",
      note: "Train fare",
      createdAt: "2026-06-01T09:00:00.000Z",
    })

    expect(expense).toBeInstanceOf(Expense)
    expect(expense.id).toBeNull()
    expect(expense.status).toBe("pending")
    expect(expense.employeeId).toBe(5)
    expect(expense.category).toBe("transport")
    expect(expense.amount).toBe(1200)
    expect(expense.spentAt).toBe("2026-06-01")
    expect(expense.note).toBe("Train fare")
  })

  test("accepts null note", () => {
    const expense = Expense.create({
      employeeId: 5,
      category: "supplies",
      amount: 500,
      spentAt: "2026-06-02",
      note: null,
      createdAt: "2026-06-02T09:00:00.000Z",
    })

    expect(expense.note).toBeNull()
  })
})

describe("Expense.withStatus", () => {
  test("returns a new Expense with the changed status", () => {
    const expense = Expense.create({
      employeeId: 5,
      category: "transport",
      amount: 1200,
      spentAt: "2026-06-01",
      note: null,
      createdAt: "2026-06-01T09:00:00.000Z",
    })

    const approved = expense.withStatus("approved")

    expect(approved).toBeInstanceOf(Expense)
    expect(approved.status).toBe("approved")
    expect(approved.employeeId).toBe(5)
    expect(approved.amount).toBe(1200)
  })
})

describe("Expense.withDetails", () => {
  test("returns a new Expense with the changed details", () => {
    const expense = Expense.create({
      employeeId: 5,
      category: "transport",
      amount: 1200,
      spentAt: "2026-06-01",
      note: "Train fare",
      createdAt: "2026-06-01T09:00:00.000Z",
    })

    const revised = expense.withDetails({
      category: "books",
      amount: 3000,
      spentAt: "2026-06-05",
      note: "Technical book",
    })

    expect(revised).toBeInstanceOf(Expense)
    expect(revised.category).toBe("books")
    expect(revised.amount).toBe(3000)
    expect(revised.spentAt).toBe("2026-06-05")
    expect(revised.note).toBe("Technical book")
    expect(revised.employeeId).toBe(5)
    expect(revised.status).toBe("pending")
  })
})
