import { canModifyEnrollment } from "@/contexts/company/application/training/can-modify-enrollment"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canModifyEnrollment", () => {
  test("owner can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 5,
        session: makeTestSession("member"),
      }),
    ).toBe(true)
  })

  test("non-owner with manager role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("manager"),
      }),
    ).toBe(true)
  })

  test("non-owner with hr role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("hr"),
      }),
    ).toBe(true)
  })

  test("non-owner with admin role can modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("root"),
      }),
    ).toBe(true)
  })

  test("non-owner with member role cannot modify", () => {
    expect(
      canModifyEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("member"),
      }),
    ).toBe(false)
  })
})
