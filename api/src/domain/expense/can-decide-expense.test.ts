import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { describe, expect, test } from "bun:test"

describe("canDecideExpense", () => {
  test("manager can decide", () => {
    expect(canDecideExpense("manager")).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideExpense("hr")).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideExpense("admin")).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideExpense("member")).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideExpense("unknown")).toBe(false)
  })
})
