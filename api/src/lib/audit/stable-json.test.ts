import { describe, expect, test } from "bun:test"
import { PayloadTooLargeError, ValidationError } from "@/lib/errors"
import { toStableAuditJson } from "@/lib/audit/stable-json"
import type { AuditJsonValue } from "@/lib/audit/stable-json"

function expectInvalidJson(value: unknown): void {
  try {
    toStableAuditJson(value as AuditJsonValue)
    throw new Error("expected invalid audit JSON to be rejected")
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).code).toBe("audit_invalid_json")
  }
}

function expectPayloadTooLarge(value: AuditJsonValue): void {
  try {
    toStableAuditJson(value)
    throw new Error("expected oversized audit JSON to be rejected")
  } catch (error) {
    expect(error).toBeInstanceOf(PayloadTooLargeError)
    expect((error as PayloadTooLargeError).code).toBe("audit_payload_too_large")
  }
}

describe("toStableAuditJson", () => {
  test("serializes primitives, arrays, and nested null without changing their meaning", () => {
    expect(toStableAuditJson([null, true, false, 12.5, "text"])).toBe(
      '[null,true,false,12.5,"text"]',
    )
    expect(toStableAuditJson(null)).toBeNull()
  })

  test("orders every object by Unicode code point and serializes manually", () => {
    const value = {
      z: 1,
      nested: { token: "raw", a: 2 },
    }

    expect(toStableAuditJson(value)).toBe('{"nested":{"a":2,"token":"[REDACTED]"},"z":1}')
  })

  test("keeps integer-like keys in code point order instead of JSON property order", () => {
    expect(toStableAuditJson({ 2: "two", 10: "ten", 1: "one" })).toBe(
      '{"1":"one","10":"ten","2":"two"}',
    )
  })

  test("orders BMP keys before astral keys according to Unicode code points", () => {
    const bmp = "\u{e000}"
    const astral = "\u{10000}"

    expect(toStableAuditJson({ [astral]: "astral", [bmp]: "bmp", a: "ascii" })).toBe(
      `{"a":"ascii","${bmp}":"bmp","${astral}":"astral"}`,
    )
  })

  test("redacts every normalized secret-key variant but preserves token_version", () => {
    const value = {
      password: "raw",
      PASSWORD: "raw",
      secret: "raw",
      token: "raw",
      Authorization: "raw",
      cookie: "raw",
      "set-cookie": "raw",
      private_key: "raw",
      "client-secret": "raw",
      accessToken: "raw",
      refresh_token: "raw",
      password_hash: "raw",
      token_version: 7,
    }
    const serialized = toStableAuditJson(value)
    const parsed = JSON.parse(serialized ?? "null") as Record<string, unknown>

    for (const key of Object.keys(value).filter((key) => key !== "token_version")) {
      expect(parsed[key]).toBe("[REDACTED]")
    }
    expect(parsed.token_version).toBe(7)
  })

  test("redacts secrets recursively through arrays and objects", () => {
    expect(
      toStableAuditJson({ entries: [{ nested: { RefreshToken: "raw" } }], safe: "visible" }),
    ).toBe('{"entries":[{"nested":{"RefreshToken":"[REDACTED]"}}],"safe":"visible"}')
  })

  test("allows null-prototype plain objects", () => {
    const value = Object.create(null) as Record<string, AuditJsonValue>
    value.z = 1
    value.a = 2

    expect(toStableAuditJson(value)).toBe('{"a":2,"z":1}')
  })

  test("allows non-cyclic shared references", () => {
    const shared = { a: 1 }

    expect(toStableAuditJson({ left: shared, right: shared })).toBe(
      '{"left":{"a":1},"right":{"a":1}}',
    )
  })

  test("does not mutate the source while ordering and redacting", () => {
    const value = { z: [{ password: "raw", b: 2, a: 1 }], a: "first" }
    const snapshot = structuredClone(value)

    expect(toStableAuditJson(value)).toBe(
      '{"a":"first","z":[{"a":1,"b":2,"password":"[REDACTED]"}]}',
    )
    expect(value).toEqual(snapshot)
    expect(value.z[0]?.password).toBe("raw")
  })

  test.each([
    ["undefined", undefined],
    ["bigint", 1n],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["function", () => undefined],
    ["symbol", Symbol("value")],
    ["Date", new Date("2026-01-01T00:00:00Z")],
    ["class instance", new (class AuditValue {})()],
  ])("rejects unsupported %s values", (_name, value) => {
    expectInvalidJson(value)
  })

  test("rejects symbol keys", () => {
    const value = { safe: true, [Symbol("hidden")]: "raw" }

    expectInvalidJson(value)
  })

  test("rejects accessors without executing their getter", () => {
    let getterCalls = 0
    const value = Object.create(null) as Record<string, unknown>
    Object.defineProperty(value, "password", {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error("getter must not execute")
      },
    })

    expectInvalidJson(value)
    expect(getterCalls).toBe(0)
  })

  test("rejects array accessors without executing their getter", () => {
    let getterCalls = 0
    const value: unknown[] = []
    Object.defineProperty(value, "0", {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error("getter must not execute")
      },
    })
    value.length = 1

    expectInvalidJson(value)
    expect(getterCalls).toBe(0)
  })

  test("rejects sparse arrays", () => {
    const sparse: unknown[] = []
    sparse.length = 2

    expectInvalidJson(sparse)
  })

  test("rejects direct and mutual cycles while allowing the test harness to inspect the error", () => {
    const direct: Record<string, unknown> = {}
    direct.self = direct
    expectInvalidJson(direct)

    const left: Record<string, unknown> = {}
    const right: Record<string, unknown> = { left }
    left.right = right
    expectInvalidJson(left)
  })

  test("rejects invalid values and cycles even when their key would be redacted", () => {
    expectInvalidJson({ password: Symbol("hidden") })

    const cyclicSecret: Record<string, unknown> = {}
    cyclicSecret.token = cyclicSecret
    expectInvalidJson(cyclicSecret)
  })

  test("rejects excessive depth as an application error instead of leaking RangeError", () => {
    const root: Record<string, unknown> = {}
    let cursor = root
    for (let index = 0; index < 2_000; index += 1) {
      const child: Record<string, unknown> = {}
      cursor.child = child
      cursor = child
    }

    expectInvalidJson(root)
  })

  test("allows exactly 65,536 UTF-8 bytes", () => {
    const serialized = toStableAuditJson({ value: "x".repeat(65_524) })

    expect(serialized).not.toBeNull()
    expect(new TextEncoder().encode(serialized ?? "").byteLength).toBe(65_536)
  })

  test("rejects 65,537 UTF-8 bytes", () => {
    expectPayloadTooLarge({ value: "x".repeat(65_525) })
  })

  test("uses UTF-8 bytes, not JavaScript string length, at the multi-byte boundary", () => {
    const exactlyAtLimit = `a${"€".repeat(21_841)}`
    const aboveLimit = `aa${"€".repeat(21_841)}`
    const serialized = toStableAuditJson({ value: exactlyAtLimit })

    expect(new TextEncoder().encode(serialized ?? "").byteLength).toBe(65_536)
    expectPayloadTooLarge({ value: aboveLimit })
  })
})
