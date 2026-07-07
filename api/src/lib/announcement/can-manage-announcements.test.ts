import { canManageAnnouncements } from "@/lib/announcement/can-manage-announcements"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageAnnouncements", () => {
  test("hr can manage", () => {
    expect(canManageAnnouncements(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageAnnouncements(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageAnnouncements(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageAnnouncements(makeTestSession("unknown"))).toBe(false)
  })
})
