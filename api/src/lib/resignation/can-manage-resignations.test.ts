import { canManageResignations } from "@/lib/resignation/can-manage-resignations"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageResignations", () => {
  test("hr can manage", () => {
    expect(canManageResignations(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageResignations(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageResignations(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageResignations(makeTestSession("member"))).toBe(false)
  })
})
