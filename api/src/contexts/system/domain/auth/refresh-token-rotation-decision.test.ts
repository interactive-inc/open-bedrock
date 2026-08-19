import { describe, expect, test } from "bun:test"
import { refreshTokenRotationDecisions } from "./refresh-token-rotation-decision"

describe("RefreshTokenRotationDecision", () => {
  test("defines the closed System rotation vocabulary", () => {
    expect(refreshTokenRotationDecisions).toEqual(["rotated", "reused", "invalid"])
    expect(Object.isFrozen(refreshTokenRotationDecisions)).toBe(true)
  })
})
