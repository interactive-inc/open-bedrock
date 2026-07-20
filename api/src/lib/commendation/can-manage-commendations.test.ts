import { canManageCommendations } from "@/lib/commendation/can-manage-commendations"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageCommendations", () => {
  test("hr can manage", () => {
    expect(canManageCommendations(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageCommendations(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageCommendations(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageCommendations(makeTestSession("member"))).toBe(false)
  })
})
