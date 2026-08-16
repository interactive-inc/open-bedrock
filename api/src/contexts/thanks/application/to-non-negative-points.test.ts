import { toNonNegativePoints } from "@/contexts/thanks/application/to-non-negative-points"
import { describe, expect, test } from "bun:test"

describe("toNonNegativePoints", () => {
  test("null returns 0", () => {
    expect(toNonNegativePoints(null)).toBe(0)
  })

  test("undefined returns 0", () => {
    expect(toNonNegativePoints(undefined)).toBe(0)
  })

  test("0 returns 0", () => {
    expect(toNonNegativePoints(0)).toBe(0)
  })

  test("positive integer returns that number", () => {
    expect(toNonNegativePoints(100)).toBe(100)
  })

  test("negative returns Error", () => {
    expect(toNonNegativePoints(-1)).toBeInstanceOf(Error)
  })

  test("non-integer returns Error", () => {
    expect(toNonNegativePoints(3.5)).toBeInstanceOf(Error)
  })

  test("exceeding max returns Error", () => {
    expect(toNonNegativePoints(10001)).toBeInstanceOf(Error)
  })
})
