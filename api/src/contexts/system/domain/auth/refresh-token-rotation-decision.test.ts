import { describe, expect, test } from "bun:test"
import {
  hasExactRefreshTokenRotationDecisions,
  parseRefreshTokenRotationDecision,
  refreshTokenRotationDecisions,
} from "./refresh-token-rotation-decision"

describe("RefreshTokenRotationDecision", () => {
  test("defines the closed System rotation vocabulary", () => {
    expect(refreshTokenRotationDecisions).toEqual(["rotated", "reused", "invalid"])
    expect(Object.isFrozen(refreshTokenRotationDecisions)).toBe(true)
  })

  test("parses only known decisions", () => {
    for (const decision of refreshTokenRotationDecisions) {
      expect(parseRefreshTokenRotationDecision(decision)).toBe(decision)
    }

    for (const value of [undefined, null, "missing", "ROTATED", "", 1, {}]) {
      expect(parseRefreshTokenRotationDecision(value)).toBeNull()
    }
  })

  test("accepts a complete decision set in any order", () => {
    expect(hasExactRefreshTokenRotationDecisions(["rotated", "reused", "invalid"])).toBe(true)
    expect(hasExactRefreshTokenRotationDecisions(["invalid", "rotated", "reused"])).toBe(true)
  })

  test("rejects incomplete, duplicated, unknown, and extended decision sets", () => {
    expect(hasExactRefreshTokenRotationDecisions([])).toBe(false)
    expect(hasExactRefreshTokenRotationDecisions(["rotated", "reused"])).toBe(false)
    expect(hasExactRefreshTokenRotationDecisions(["rotated", "reused", "reused"])).toBe(false)
    expect(hasExactRefreshTokenRotationDecisions(["rotated", "reused", "missing"])).toBe(false)
    expect(hasExactRefreshTokenRotationDecisions(["rotated", "reused", "invalid", "future"])).toBe(
      false,
    )
  })
})
