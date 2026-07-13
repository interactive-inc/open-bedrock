import { describe, expect, test } from "bun:test"
import { UnavailableError } from "@/lib/errors"
import { hashAuditIdentifier } from "@/lib/audit/hash-identifier"

describe("hashAuditIdentifier", () => {
  test("normalizes identifiers and returns deterministic lower-case SHA-256 HMAC hex", async () => {
    const first = await hashAuditIdentifier(" User@Example.COM ", "secret-a")
    const second = await hashAuditIdentifier("user@example.com", "secret-a")

    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).not.toContain("example.com")
  })

  test("uses the fixed domain-separated message golden vector", async () => {
    expect(await hashAuditIdentifier("user@example.com", "secret-a")).toBe(
      "9aa2dcf6038259fb1714d8964381b16dffc7b6718cbe37c66ced1dd539af6a65",
    )
  })

  test("produces a different digest with a different secret", async () => {
    const first = await hashAuditIdentifier("user@example.com", "secret-a")
    const second = await hashAuditIdentifier("user@example.com", "secret-b")

    expect(second).not.toBe(first)
  })

  test.each(["", "   ", "\t\n"])(
    "fails closed when the audit HMAC secret is empty",
    async (secret) => {
      try {
        await hashAuditIdentifier("user@example.com", secret)
        throw new Error("expected an empty HMAC secret to be rejected")
      } catch (error) {
        expect(error).toBeInstanceOf(UnavailableError)
        expect((error as UnavailableError).code).toBe("audit_hmac_secret_invalid")
      }
    },
  )

  test("fails closed when the runtime binding is missing", async () => {
    try {
      await hashAuditIdentifier("user@example.com", undefined as unknown as string)
      throw new Error("expected a missing HMAC secret to be rejected")
    } catch (error) {
      expect(error).toBeInstanceOf(UnavailableError)
      expect((error as UnavailableError).code).toBe("audit_hmac_secret_invalid")
    }
  })
})
