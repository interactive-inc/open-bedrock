import { describe, expect, test } from "bun:test"
import { ValidationError } from "@/lib/errors"
import { decodeAuditCursor, encodeAuditCursor } from "@/lib/audit/audit-cursor"

function encodeRawJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

describe("audit cursor", () => {
  test("round-trips the canonical position including a legacy negative id", () => {
    const position = { version: 1 as const, direction: "next" as const, createdAt: 100, id: -7 }

    expect(decodeAuditCursor(encodeAuditCursor(position))).toEqual(position)
  })

  test.each(["not+base64url", "eyJ2ZXJzaW9uIjoxfQ==", "a".repeat(257), "bm90LWpzb24", "_w"])(
    "rejects malformed token %s with the stable cursor error",
    (token) => {
      try {
        decodeAuditCursor(token)
        throw new Error("expected cursor rejection")
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).code).toBe("invalid_audit_cursor")
        expect((error as ValidationError).message).toBe("audit cursor is invalid")
      }
    },
  )

  test.each([
    ['{"version":1,"direction":"next","createdAt":100,"id":7,"extra":true}', "extra key"],
    ['{"version":2,"direction":"next","createdAt":100,"id":7}', "unknown version"],
    ['{"version":1,"direction":"sideways","createdAt":100,"id":7}', "unknown direction"],
    ['{"version":1,"direction":"next","createdAt":100.5,"id":7}', "fractional time"],
    ['{"version":1,"direction":"next","createdAt":100,"id":7.5}', "fractional id"],
    ['{"version":1,"direction":"next","createdAt":9007199254740992,"id":7}', "unsafe time"],
    ['{"version":1,"direction":"next","createdAt":100,"id":9007199254740992}', "unsafe id"],
    ['{"version":1,"direction":"next","createdAt":100}', "missing key"],
    ['[1,"next",100,7]', "array payload"],
  ])("rejects a decoded payload with %s", (json) => {
    expect(() => decodeAuditCursor(encodeRawJson(json))).toThrow(ValidationError)
  })

  test.each([
    '{ "version":1,"direction":"next","createdAt":100,"id":7}',
    '{"direction":"next","version":1,"createdAt":100,"id":7}',
    '{"version":1,"direction":"next","createdAt":1e2,"id":7}',
  ])("rejects noncanonical JSON spelling or property order", (json) => {
    expect(() => decodeAuditCursor(encodeRawJson(json))).toThrow(ValidationError)
  })

  test("accepts next and previous as the two directions", () => {
    for (const direction of ["next", "previous"] as const) {
      const position = { version: 1 as const, direction, createdAt: 100, id: 7 }
      expect(decodeAuditCursor(encodeAuditCursor(position))).toEqual(position)
    }
  })

  test("accepts a position change when the unsigned cursor is correctly re-encoded", () => {
    const original = encodeAuditCursor({ version: 1, direction: "next", createdAt: 100, id: 7 })
    const changed = encodeAuditCursor({
      ...decodeAuditCursor(original),
      createdAt: 101,
      id: 8,
    })

    expect(decodeAuditCursor(changed)).toEqual({
      version: 1,
      direction: "next",
      createdAt: 101,
      id: 8,
    })
  })
})
