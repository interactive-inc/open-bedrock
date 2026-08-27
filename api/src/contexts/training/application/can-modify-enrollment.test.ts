import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { canModifyEnrollment } from "@/contexts/training/domain/policies/enrollment-modification.policy"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canModifyEnrollment", () => {
  test("owner can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(5),
        session: makeTestSession("member"),
      }),
    ).toBe(true)
  })

  test("non-owner with manager role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("manager"),
      }),
    ).toBe(true)
  })

  test("non-owner with hr role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("hr"),
      }),
    ).toBe(true)
  })

  test("non-owner with admin role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("root"),
      }),
    ).toBe(true)
  })

  test("non-owner with member role cannot modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
        session: makeTestSession("member"),
      }),
    ).toBe(false)
  })
})
