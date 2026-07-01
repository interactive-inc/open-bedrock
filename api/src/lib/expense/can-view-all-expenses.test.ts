import { canViewAllExpenses } from "@/lib/expense/can-view-all-expenses"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllExpenses", () => {
  test("admin can view all", () => {
    expect(canViewAllExpenses(makeTestSession("admin"))).toBe(true)
  })

  test("hr can view all", () => {
    expect(canViewAllExpenses(makeTestSession("hr"))).toBe(true)
  })

  test("manager cannot view all", () => {
    expect(canViewAllExpenses(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllExpenses(makeTestSession("member"))).toBe(false)
  })
})
