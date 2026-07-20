import { canCompleteEnrollment } from "@/application/training/can-complete-enrollment"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canCompleteEnrollment", () => {
  test("owner can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 5,
        session: makeTestSession("member"),
      }),
    ).toBe(true)
  })

  test("non-owner with manager role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("manager"),
      }),
    ).toBe(true)
  })

  test("non-owner with hr role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("hr"),
      }),
    ).toBe(true)
  })

  test("non-owner with admin role can complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("admin"),
      }),
    ).toBe(true)
  })

  test("non-owner with member role cannot complete", () => {
    expect(
      canCompleteEnrollment({
        enrollmentEmployeeId: 5,
        viewerEmployeeId: 6,
        session: makeTestSession("member"),
      }),
    ).toBe(false)
  })
})
