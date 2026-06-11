import { toApplicationId } from "@/domain/application/to-application-id"
import { describe, expect, test } from "bun:test"

describe("toApplicationId", () => {
  test("valid positive integer returns number", () => {
    expect(toApplicationId("42")).toBe(42)
  })

  test("zero returns null", () => {
    expect(toApplicationId("0")).toBe(null)
  })

  test("negative returns null", () => {
    expect(toApplicationId("-1")).toBe(null)
  })

  test("non-integer returns null", () => {
    expect(toApplicationId("1.5")).toBe(null)
  })

  test("non-numeric returns null", () => {
    expect(toApplicationId("abc")).toBe(null)
  })
})
