import { describe, expect, test } from "bun:test"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { NotFoundError } from "@/interface/lib/errors"

describe("validateIntParam", () => {
  test("returns a valid positive integer", () => {
    expect(validateIntParam("42", "item")).toBe(42)
  })

  test("returns 1 as the smallest valid value", () => {
    expect(validateIntParam("1", "item")).toBe(1)
  })

  test("throws NotFoundError for zero", () => {
    expect(() => validateIntParam("0", "item")).toThrow()
  })

  test("throws NotFoundError for a negative number", () => {
    expect(() => validateIntParam("-1", "item")).toThrow()
  })

  test("throws NotFoundError for a decimal number", () => {
    expect(() => validateIntParam("3.14", "item")).toThrow()
  })

  test("throws NotFoundError for a non-numeric string", () => {
    expect(() => validateIntParam("abc", "item")).toThrow()
  })

  test("throws NotFoundError for an empty string", () => {
    expect(() => validateIntParam("", "item")).toThrow()
  })

  test("throws NotFoundError for undefined", () => {
    expect(() => validateIntParam(undefined, "item")).toThrow()
  })

  test("throws NotFoundError for a mixed string like '50abc'", () => {
    expect(() => validateIntParam("50abc", "item")).toThrow()
  })

  test("throws NotFoundError for a value exceeding MAX_SAFE_INTEGER", () => {
    expect(() => validateIntParam("9999999999999999", "item")).toThrow()
  })

  test("thrown error has status 404", () => {
    try {
      validateIntParam("bad", "item")
      expect.unreachable("should have thrown")
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundError)

      if (error instanceof NotFoundError) {
        expect(error.status).toBe(404)
      }
    }
  })
})
