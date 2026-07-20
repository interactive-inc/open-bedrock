import { canManageRecruitment } from "@/lib/recruitment/can-manage-recruitment"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageRecruitment", () => {
  test("hr can manage (社外個人情報を扱う人事)", () => {
    expect(canManageRecruitment(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRecruitment(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageRecruitment(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageRecruitment(makeTestSession("member"))).toBe(false)
  })
})
