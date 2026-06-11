import { canModifyEnrollment } from "@/domain/training/can-modify-enrollment"
import { describe, expect, test } from "bun:test"

describe("canModifyEnrollment", () => {
  test("owner can modify", () => {
    expect(
      canModifyEnrollment({ enrollmentEmployeeId: 5, viewerEmployeeId: 5, viewerRole: "member" }),
    ).toBe(true)
  })

  test("non-owner with manager role can modify", () => {
    expect(
      canModifyEnrollment({ enrollmentEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "manager" }),
    ).toBe(true)
  })

  test("non-owner with hr role can modify", () => {
    expect(
      canModifyEnrollment({ enrollmentEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "hr" }),
    ).toBe(true)
  })

  test("non-owner with admin role can modify", () => {
    expect(
      canModifyEnrollment({ enrollmentEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "admin" }),
    ).toBe(true)
  })

  test("non-owner with member role cannot modify", () => {
    expect(
      canModifyEnrollment({ enrollmentEmployeeId: 5, viewerEmployeeId: 6, viewerRole: "member" }),
    ).toBe(false)
  })
})
