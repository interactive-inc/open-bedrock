import { describe, expect, test } from "bun:test"
import {
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"

describe("toBoundedInt", () => {
  test("parses a plain integer string", () => {
    expect(toBoundedInt({ raw: "20", fallback: 50, min: 1, max: 100 })).toBe(20)
  })

  test("falls back when unspecified", () => {
    expect(toBoundedInt({ raw: undefined, fallback: 50, min: 1, max: 100 })).toBe(50)
  })

  test("falls back on a mixed string (does not greedily take leading digits)", () => {
    // Number.parseInt("50abc") は 50 を返すが、Number("50abc") は NaN。
    expect(toBoundedInt({ raw: "50abc", fallback: 50, min: 1, max: 100 })).toBe(50)
  })

  test("falls back on a non-integer (decimal) value", () => {
    expect(toBoundedInt({ raw: "12.5", fallback: 50, min: 1, max: 100 })).toBe(50)
  })

  test("falls back below min and clamps above max", () => {
    expect(toBoundedInt({ raw: "0", fallback: 50, min: 1, max: 100 })).toBe(50)
    expect(toBoundedInt({ raw: "999", fallback: 50, min: 1, max: 100 })).toBe(100)
  })

  test("clamps a huge offset to the SQLite 32-bit max", () => {
    expect(toBoundedInt({ raw: "9999999999999", fallback: 0, min: 0, max: MAX_LIST_OFFSET })).toBe(
      MAX_LIST_OFFSET,
    )
  })
})
