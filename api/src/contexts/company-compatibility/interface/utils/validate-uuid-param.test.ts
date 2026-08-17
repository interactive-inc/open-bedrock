import { describe, expect, test } from "bun:test"
import { validateUuidParam } from "@/contexts/company-compatibility/interface/utils/validate-uuid-param"
import { NotFoundError } from "@/contexts/company-compatibility/interface/lib/errors"

describe("validateUuidParam", () => {
  test("returns a valid UUID string as-is", () => {
    expect(validateUuidParam("550e8400-e29b-41d4-a716-446655440000", "item")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    )
  })

  test("accepts all-zero UUID", () => {
    expect(validateUuidParam("00000000-0000-0000-0000-000000000000", "item")).toBe(
      "00000000-0000-0000-0000-000000000000",
    )
  })

  test("throws NotFoundError for an empty string", () => {
    expect(() => validateUuidParam("", "item")).toThrow()
  })

  test("throws NotFoundError for undefined", () => {
    expect(() => validateUuidParam(undefined, "item")).toThrow()
  })

  test("throws NotFoundError for a non-UUID string", () => {
    expect(() => validateUuidParam("not-a-uuid", "item")).toThrow()
  })

  test("throws NotFoundError for uppercase UUID", () => {
    expect(() => validateUuidParam("550E8400-E29B-41D4-A716-446655440000", "item")).toThrow()
  })

  test("throws NotFoundError for a UUID without hyphens", () => {
    expect(() => validateUuidParam("550e8400e29b41d4a716446655440000", "item")).toThrow()
  })

  test("throws NotFoundError for an overly long string", () => {
    expect(() => validateUuidParam("a".repeat(200), "item")).toThrow()
  })

  test("thrown error has status 404", () => {
    try {
      validateUuidParam("bad", "item")
      expect.unreachable("should have thrown")
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundError)

      if (error instanceof NotFoundError) {
        expect(error.status).toBe(404)
      }
    }
  })
})
