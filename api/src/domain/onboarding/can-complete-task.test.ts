import { canCompleteTask } from "@/domain/onboarding/can-complete-task"
import { describe, expect, test } from "bun:test"

describe("canCompleteTask", () => {
  test("owner can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, viewerEmployeeId: 5, viewerRole: "member" })).toBe(
      true,
    )
  })

  test("non-owner with manager role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "manager" })).toBe(
      true,
    )
  })

  test("non-owner with hr role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "hr" })).toBe(true)
  })

  test("non-owner with admin role can complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "admin" })).toBe(
      true,
    )
  })

  test("non-owner with member role cannot complete", () => {
    expect(canCompleteTask({ taskEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "member" })).toBe(
      false,
    )
  })
})
