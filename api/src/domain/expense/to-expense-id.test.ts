import { toExpenseId } from "@/domain/expense/to-expense-id"
import { describe, expect, test } from "bun:test"

describe("toExpenseId", () => {
  test("valid positive integer string returns number", () => {
    expect(toExpenseId("42")).toBe(42)
  })

  test('"1" returns 1', () => {
    expect(toExpenseId("1")).toBe(1)
  })

  test('"0" returns null', () => {
    expect(toExpenseId("0")).toBeNull()
  })

  test("negative returns null", () => {
    expect(toExpenseId("-5")).toBeNull()
  })

  test("non-integer returns null", () => {
    expect(toExpenseId("3.14")).toBeNull()
  })

  test("non-numeric returns null", () => {
    expect(toExpenseId("abc")).toBeNull()
  })
})
