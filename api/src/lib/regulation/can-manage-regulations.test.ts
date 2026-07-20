import { canManageRegulations } from "@/lib/regulation/can-manage-regulations"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageRegulations", () => {
  test("hr can manage", () => {
    expect(canManageRegulations(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRegulations(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageRegulations(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageRegulations(makeTestSession("unknown"))).toBe(false)
  })
})
