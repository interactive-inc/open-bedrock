import { sessionMaxAge } from "@/lib/auth/session-max-age"
import { describe, expect, test } from "bun:test"
describe("probe", () => {
  test("resolves alias and Buffer", () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = Buffer.from(JSON.stringify({ exp: now + 3600 })).toString("base64url")
    const token = `h.${payload}.s`
    expect(sessionMaxAge(token)).toBeGreaterThan(3500)
  })
})
