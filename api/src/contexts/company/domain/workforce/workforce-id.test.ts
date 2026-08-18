import { InvalidWorkforceIdError } from "@/contexts/company/domain/workforce/invalid-workforce-id-error"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { describe, expect, test } from "bun:test"

describe("restoreWorkforceId", () => {
  test("accepts storage-neutral identifiers", () => {
    expect(String(restoreWorkforceId("employee", "employee:01.HQ"))).toBe("employee:01.HQ")
    expect(String(restoreWorkforceId("employment", "42"))).toBe("42")
  })

  test("rejects empty, padded, unsafe, and oversized identifiers", () => {
    for (const value of ["", " employee-1", "employee/1", "x".repeat(129)]) {
      expect(() => restoreWorkforceId("employee", value)).toThrow(InvalidWorkforceIdError)
    }
  })
})
