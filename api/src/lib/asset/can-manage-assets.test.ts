import { canManageAssets } from "@/lib/asset/can-manage-assets"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageAssets", () => {
  test("manager can manage", () => {
    expect(canManageAssets(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageAssets(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageAssets(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageAssets(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageAssets(makeTestSession("unknown"))).toBe(false)
  })
})
