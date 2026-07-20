import { canCreateOneOnOne } from "@/lib/oneonone/can-create-one-on-one"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canCreateOneOnOne", () => {
  test("manager can create", () => {
    expect(canCreateOneOnOne(makeTestSession("manager"))).toBe(true)
  })

  test("hr can create", () => {
    expect(canCreateOneOnOne(makeTestSession("hr"))).toBe(true)
  })

  test("admin can create", () => {
    expect(canCreateOneOnOne(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot create", () => {
    expect(canCreateOneOnOne(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot create", () => {
    expect(canCreateOneOnOne(makeTestSession("viewer"))).toBe(false)
  })
})
