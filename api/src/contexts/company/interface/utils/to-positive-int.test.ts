import { toPositiveInt } from "@/contexts/company/interface/utils/to-positive-int"
import { describe, expect, test } from "bun:test"

describe("toPositiveInt", () => {
  test("valid positive integer string returns number", () => {
    expect(toPositiveInt("42")).toBe(42)
  })

  test("valid positive number returns number", () => {
    expect(toPositiveInt(7)).toBe(7)
  })

  test('"0" returns null', () => {
    expect(toPositiveInt("0")).toBeNull()
  })

  test("negative returns null", () => {
    expect(toPositiveInt("-5")).toBeNull()
  })

  test("non-integer returns null", () => {
    expect(toPositiveInt("3.14")).toBeNull()
  })

  test("greater than MAX_SAFE_INTEGER returns null", () => {
    expect(toPositiveInt(Number.MAX_SAFE_INTEGER + 1)).toBeNull()
  })
})
