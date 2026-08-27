import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { canCompleteEnrollment } from "@/contexts/training/domain/policies/enrollment-completion.policy"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canCompleteEnrollment", () => {
  test("owner can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("member"),
      }),
    ).toBe(true)
  })

  test("non-owner with manager role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("manager"),
      }),
    ).toBe(true)
  })

  test("non-owner with hr role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("hr"),
      }),
    ).toBe(true)
  })

  test("non-owner with admin role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("root"),
      }),
    ).toBe(true)
  })

  test("non-owner with member role cannot complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("member"),
      }),
    ).toBe(false)
  })
})
