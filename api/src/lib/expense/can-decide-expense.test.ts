import { canDecideExpense } from "@/lib/expense/can-decide-expense"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canDecideExpense", () => {
  test("manager can decide", () => {
    expect(canDecideExpense(makeTestSession("manager"))).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideExpense(makeTestSession("hr"))).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideExpense(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideExpense(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideExpense(makeTestSession("unknown"))).toBe(false)
  })
})
