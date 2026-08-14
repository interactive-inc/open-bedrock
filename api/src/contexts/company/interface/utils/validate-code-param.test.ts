import { describe, expect, test } from "bun:test"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { NotFoundError } from "@/interface/lib/errors"

describe("validateCodeParam", () => {
  test("returns a valid code string as-is", () => {
    expect(validateCodeParam("EMP001", "employee")).toBe("EMP001")
  })

  test("accepts a single-character code", () => {
    expect(validateCodeParam("A", "department")).toBe("A")
  })

  test("accepts a 64-character code (max length)", () => {
    const code = "a".repeat(64)

    expect(validateCodeParam(code, "item")).toBe(code)
  })

  test("throws NotFoundError for an empty string", () => {
    expect(() => validateCodeParam("", "employee")).toThrow()
  })

  test("throws NotFoundError for undefined", () => {
    expect(() => validateCodeParam(undefined, "employee")).toThrow()
  })

  test("throws NotFoundError for a string exceeding 64 characters", () => {
    expect(() => validateCodeParam("a".repeat(65), "employee")).toThrow()
  })

  test("thrown error has status 404", () => {
    try {
      validateCodeParam("", "employee")
      expect.unreachable("should have thrown")
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundError)

      if (error instanceof NotFoundError) {
        expect(error.status).toBe(404)
      }
    }
  })
})
