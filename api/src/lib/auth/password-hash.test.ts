import { describe, expect, test } from "bun:test"
import { toPasswordHash } from "@/lib/auth/to-password-hash"
import { verifyPassword } from "@/lib/auth/verify-password"

describe("toPasswordHash (PBKDF2 new format)", () => {
  test("returns a string with the pbkdf2 prefix and 4 colon-separated parts", async () => {
    const hashed = await toPasswordHash("password")

    const parts = hashed.split(":")

    expect(parts.length).toBe(4)
    expect(parts[0]).toBe("pbkdf2")
    expect(parts[1]).toBe("100000")
    expect((parts[2] ?? "").length > 0).toBe(true)
    expect((parts[3] ?? "").length > 0).toBe(true)
  })

  test("produces a different hash each call (random per-user salt)", async () => {
    const a = await toPasswordHash("password")
    const b = await toPasswordHash("password")

    expect(a).not.toBe(b)
  })
})

describe("verifyPassword (new format)", () => {
  test("verifies a freshly generated PBKDF2 hash", async () => {
    const hashed = await toPasswordHash("correct-horse-battery")

    expect(await verifyPassword("correct-horse-battery", hashed)).toBe(true)
  })

  test("rejects a wrong password against a PBKDF2 hash", async () => {
    const hashed = await toPasswordHash("correct-horse-battery")

    expect(await verifyPassword("wrong-password", hashed)).toBe(false)
  })

  test("returns false for a malformed pbkdf2 stored value", async () => {
    expect(await verifyPassword("anything", "pbkdf2:abc:def")).toBe(false)
    expect(await verifyPassword("anything", "pbkdf2:100000:!!notbase64??:!!nope??")).toBe(false)
  })
})
