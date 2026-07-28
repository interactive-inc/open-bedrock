import { LifecycleCursor, type LifecycleCursorValue } from "@/lib/pagination/lifecycle-cursor"
import { describe, expect, test } from "bun:test"

const secret = "lifecycle-cursor-test-secret"

const value: LifecycleCursorValue = {
  version: 1,
  filterFingerprint: "filter-v1",
  anchorRowId: 42,
  position: {
    eventOn: "2026-07-01",
    recordedAt: 1_782_860_400,
    id: "00000000-0000-4000-8000-000000000001",
  },
  limit: 25,
}

describe("lifecycle cursor", () => {
  test("round trips a signed stable scan position", async () => {
    const encoded = await LifecycleCursor.encode(value, secret)
    expect(encoded.length).toBeLessThanOrEqual(256)
    expect(await LifecycleCursor.decode(encoded, secret)).toEqual(value)
  })

  test("rejects tampering, an overlong value, and malformed content", async () => {
    const encoded = await LifecycleCursor.encode(value, secret)
    const changed = `${encoded.startsWith("a") ? "b" : "a"}${encoded.slice(1)}`
    expect(await LifecycleCursor.decode(changed, secret)).toBeInstanceOf(Error)
    expect(await LifecycleCursor.decode("x".repeat(257), secret)).toBeInstanceOf(Error)
    expect(await LifecycleCursor.decode("not-a-cursor", secret)).toBeInstanceOf(Error)
  })
})
