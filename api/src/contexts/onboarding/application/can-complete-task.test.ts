import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { canCompleteTask } from "@/contexts/onboarding/domain/policies/task-completion.policy"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canCompleteTask", () => {
  test("owner can complete", () => {
    expect(
      canCompleteTask({
        taskEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("member", 5),
      }),
    ).toBe(true)
  })

  test("non-owner with manager role can complete", () => {
    expect(
      canCompleteTask({
        taskEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("manager", 6),
      }),
    ).toBe(true)
  })

  test("non-owner with hr role can complete", () => {
    expect(
      canCompleteTask({
        taskEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("hr", 6),
      }),
    ).toBe(true)
  })

  test("non-owner with admin role can complete", () => {
    expect(
      canCompleteTask({
        taskEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("root", 6),
      }),
    ).toBe(true)
  })

  test("non-owner with member role cannot complete", () => {
    expect(
      canCompleteTask({
        taskEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("member", 6),
      }),
    ).toBe(false)
  })
})
