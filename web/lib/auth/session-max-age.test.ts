import { sessionMaxAge } from "@/lib/auth/session-max-age"
import { describe, expect, test } from "bun:test"

const fallbackSeconds = 60 * 60 * 8

// payload を base64url で詰めた、署名なしの簡易 JWT を作る（exp の読み取りのみ検証する）。
function tokenWithPayload(payload: Record<string, unknown>): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url")

  return `header.${segment}.signature`
}

describe("sessionMaxAge", () => {
  test("returns the remaining seconds for a valid future exp", () => {
    const now = Math.floor(Date.now() / 1000)

    const result = sessionMaxAge(tokenWithPayload({ exp: now + 3600 }))

    expect(result).toBeGreaterThan(3500)
    expect(result).toBeLessThanOrEqual(3600)
  })

  test("falls back to 8h for a non-JWT string", () => {
    expect(sessionMaxAge("not-a-jwt")).toBe(fallbackSeconds)
  })

  test("falls back to 8h when the payload has no exp", () => {
    expect(sessionMaxAge(tokenWithPayload({ sub: "1" }))).toBe(fallbackSeconds)
  })

  test("falls back to 8h when the payload is not valid base64url JSON", () => {
    expect(sessionMaxAge("header.%%%notbase64%%%.sig")).toBe(fallbackSeconds)
  })

  test("returns 1 second for an already-expired exp (not the 8h fallback)", () => {
    const now = Math.floor(Date.now() / 1000)

    expect(sessionMaxAge(tokenWithPayload({ exp: now - 3600 }))).toBe(1)
  })
})
