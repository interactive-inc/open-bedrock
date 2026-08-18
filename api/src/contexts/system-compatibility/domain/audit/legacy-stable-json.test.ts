import { describe, expect, test } from "bun:test"
import { toStableAuditJson } from "@/contexts/system-compatibility/domain/audit/legacy-stable-json"
import { PayloadTooLargeError, ValidationError } from "@/lib/errors"

describe("toStableAuditJson compatibility adapter", () => {
  test("returns the canonical System representation", () => {
    expect(toStableAuditJson({ z: 1, password: "raw", a: 2 })).toBe(
      '{"a":2,"password":"[REDACTED]","z":1}',
    )
  })

  test("maps invalid System JSON to the existing validation error", () => {
    const serializeInvalidValue = () =>
      Reflect.apply(toStableAuditJson, undefined, [{ value: undefined }])

    expect(serializeInvalidValue).toThrow(ValidationError)

    try {
      serializeInvalidValue()
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect(error instanceof ValidationError ? error.code : null).toBe("audit_invalid_json")
    }
  })

  test("maps the System size limit to the existing payload-too-large error", () => {
    expect(() => toStableAuditJson({ value: "x".repeat(65_525) })).toThrow(PayloadTooLargeError)

    try {
      toStableAuditJson({ value: "x".repeat(65_525) })
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      expect(error instanceof PayloadTooLargeError ? error.code : null).toBe(
        "audit_payload_too_large",
      )
    }
  })
})
