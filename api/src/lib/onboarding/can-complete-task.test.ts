import { canCompleteTask } from "@/lib/onboarding/can-complete-task"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canCompleteTask", () => {
  test("owner can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, session: makeTestSession("member", 5) })).toBe(true)
  })

  test("non-owner with manager role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, session: makeTestSession("manager", 6) })).toBe(
      true,
    )
  })

  test("non-owner with hr role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, session: makeTestSession("hr", 6) })).toBe(true)
  })

  test("non-owner with admin role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, session: makeTestSession("admin", 6) })).toBe(true)
  })

  test("non-owner with member role cannot complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, session: makeTestSession("member", 6) })).toBe(
      false,
    )
  })
})
