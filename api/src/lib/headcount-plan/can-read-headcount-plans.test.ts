import { canManageHeadcountPlans } from "@/lib/headcount-plan/can-manage-headcount-plans"
import { canReadHeadcountPlans } from "@/lib/headcount-plan/can-read-headcount-plans"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("headcount plan permissions", () => {
  test("hr can manage and read", () => {
    expect(canManageHeadcountPlans(makeTestSession("hr"))).toBe(true)

    expect(canReadHeadcountPlans(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage and read", () => {
    expect(canManageHeadcountPlans(makeTestSession("admin"))).toBe(true)

    expect(canReadHeadcountPlans(makeTestSession("admin"))).toBe(true)
  })

  test("manager can neither manage nor read", () => {
    expect(canManageHeadcountPlans(makeTestSession("manager"))).toBe(false)

    expect(canReadHeadcountPlans(makeTestSession("manager"))).toBe(false)
  })

  test("member can neither manage nor read", () => {
    expect(canManageHeadcountPlans(makeTestSession("member"))).toBe(false)

    expect(canReadHeadcountPlans(makeTestSession("member"))).toBe(false)
  })
})
