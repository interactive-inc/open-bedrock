import { describe, expect, test } from "bun:test"
import {
  AUDIT_CURSOR_MAX_LENGTH,
  decodeAuditCursor,
  encodeAuditCursor,
} from "@/lib/audit/audit-cursor"
import type { AuditCursorPosition } from "@/lib/audit/audit-cursor"
import { ValidationError } from "@/lib/errors"

function encodeRawJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function position(overrides: Partial<AuditCursorPosition> = {}): AuditCursorPosition {
  return {
    version: 2,
    direction: "next",
    snapshotMaxId: 400,
    limit: 100,
    filterFingerprint: "A".repeat(22),
    sourceFirst: [100, 400],
    sourceLast: [100, -7],
    sourceHasPrevious: false,
    sourceHasNext: true,
    targetFirst: null,
    targetLast: null,
    targetHasPrevious: null,
    targetHasNext: null,
    ...overrides,
  }
}

describe("audit cursor", () => {
  test("round-trips the bounded v2 snapshot and source/target page ranges", () => {
    const value = position({
      direction: "previous",
      sourceFirst: [100, 380],
      sourceLast: [100, 361],
      sourceHasPrevious: true,
      sourceHasNext: true,
      targetFirst: [100, 400],
      targetLast: [100, 381],
      targetHasPrevious: false,
      targetHasNext: true,
    })

    const token = encodeAuditCursor(value)

    expect(token.length).toBeLessThanOrEqual(AUDIT_CURSOR_MAX_LENGTH)
    expect(decodeAuditCursor(token)).toEqual(value)
  })

  test("keeps worst-case safe signed anchors inside the cursor cap", () => {
    const maxEpochSeconds = 8_640_000_000_000
    const minEpochSeconds = -8_640_000_000_000
    const token = encodeAuditCursor(
      position({
        snapshotMaxId: Number.MAX_SAFE_INTEGER,
        sourceFirst: [maxEpochSeconds, Number.MAX_SAFE_INTEGER],
        sourceLast: [minEpochSeconds, Number.MIN_SAFE_INTEGER],
        targetFirst: [maxEpochSeconds, Number.MIN_SAFE_INTEGER],
        targetLast: [minEpochSeconds, Number.MAX_SAFE_INTEGER],
        targetHasPrevious: true,
        targetHasNext: true,
      }),
    )

    expect(token.length).toBeLessThanOrEqual(AUDIT_CURSOR_MAX_LENGTH)
    expect(decodeAuditCursor(token).sourceLast[1]).toBe(Number.MIN_SAFE_INTEGER)
  })

  test("rejects reversed ranges, anchors beyond the snapshot, and unavailable directions", () => {
    expect(() =>
      encodeAuditCursor(position({ sourceFirst: [99, 1], sourceLast: [100, 1] })),
    ).toThrow(ValidationError)
    expect(() => encodeAuditCursor(position({ sourceFirst: [100, 401] }))).toThrow(ValidationError)
    expect(() => encodeAuditCursor(position({ sourceHasNext: false }))).toThrow(ValidationError)
  })

  test.each(["not+base64url", "eyJ2ZXJzaW9uIjoyfQ==", "a".repeat(257), "bm90LWpzb24", "_w"])(
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
    [
      '[1,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null]',
      "legacy version",
    ],
    [
      '[2,"x","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null]',
      "unknown direction",
    ],
    ['[2,"n","b4",100,"short","2s","b4","2s","1",2,null,null,null,null,null]', "short fingerprint"],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",4,null,null,null,null,null]',
      "invalid flags",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","02s","b4","2s","1",2,null,null,null,null,null]',
      "noncanonical integer",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,"2s",null,"2s","1",2]',
      "partial target",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null,"extra"]',
      "extra item",
    ],
    ['{"version":2}', "object payload"],
  ])("rejects a decoded payload with %s", (json) => {
    expect(() => decodeAuditCursor(encodeRawJson(json))).toThrow(ValidationError)
  })

  test("rejects noncanonical JSON whitespace", () => {
    const canonical = encodeAuditCursor(position())
    const decodedJson = new TextDecoder().decode(
      Uint8Array.from(
        atob(canonical.replaceAll("-", "+").replaceAll("_", "/") + "=="),
        (character) => character.charCodeAt(0),
      ),
    )

    expect(() => decodeAuditCursor(encodeRawJson(` ${decodedJson}`))).toThrow(ValidationError)
  })

  test("accepts next and previous as the two directions", () => {
    for (const direction of ["next", "previous"] as const) {
      const value = position({ direction, sourceHasPrevious: direction === "previous" })
      expect(decodeAuditCursor(encodeAuditCursor(value))).toEqual(value)
    }
  })

  test("accepts a position change when the unsigned cursor is correctly re-encoded", () => {
    const original = encodeAuditCursor(position())
    const changed = encodeAuditCursor({
      ...decodeAuditCursor(original),
      snapshotMaxId: 401,
      sourceFirst: [101, 401],
    })

    expect(decodeAuditCursor(changed).sourceFirst).toEqual([101, 401])
  })
})
