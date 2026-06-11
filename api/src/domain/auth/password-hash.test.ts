import { describe, expect, test } from "bun:test"
import { isLegacyPasswordHash, toLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { toPasswordHash } from "@/domain/auth/to-password-hash"
import { verifyPassword } from "@/domain/auth/verify-password"
import { isWrappedLegacyHash, wrapLegacyHash } from "@/domain/auth/wrap-legacy-hash"

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

describe("verifyPassword (legacy format)", () => {
  test("verifies a legacy fixed-salt SHA-256 hash for the right password", async () => {
    const legacyHash = await toLegacyPasswordHash("password")

    expect(isLegacyPasswordHash(legacyHash)).toBe(true)
    expect(await verifyPassword("password", legacyHash)).toBe(true)
  })

  test("rejects the wrong password against a legacy hash", async () => {
    const legacyHash = await toLegacyPasswordHash("password")

    expect(await verifyPassword("notpassword", legacyHash)).toBe(false)
  })
})

describe("verifyPassword (wrapped-legacy format)", () => {
  test("verifies a wrapped-legacy hash for the correct password", async () => {
    const legacyHash = await toLegacyPasswordHash("my-secret")
    const wrapped = await wrapLegacyHash(legacyHash)

    expect(isWrappedLegacyHash(wrapped)).toBe(true)
    expect(await verifyPassword("my-secret", wrapped)).toBe(true)
  })

  test("rejects the wrong password against a wrapped-legacy hash", async () => {
    const legacyHash = await toLegacyPasswordHash("my-secret")
    const wrapped = await wrapLegacyHash(legacyHash)

    expect(await verifyPassword("wrong-password", wrapped)).toBe(false)
  })

  test("produces a different wrapped hash each call (random salt)", async () => {
    const legacyHash = await toLegacyPasswordHash("password")
    const a = await wrapLegacyHash(legacyHash)
    const b = await wrapLegacyHash(legacyHash)

    expect(a).not.toBe(b)
  })

  test("returns false for a malformed wrapped-legacy stored value", async () => {
    expect(await verifyPassword("anything", "pbkdf2-wrapped-legacy:bad")).toBe(false)
    expect(await verifyPassword("anything", "pbkdf2-wrapped-legacy:abc:def:ghi")).toBe(false)
  })
})

describe("isLegacyPasswordHash", () => {
  test("returns false for new-format pbkdf2 strings", async () => {
    const hashed = await toPasswordHash("anything")

    expect(isLegacyPasswordHash(hashed)).toBe(false)
  })

  test("returns true for raw hex strings (legacy)", () => {
    expect(
      isLegacyPasswordHash("44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247"),
    ).toBe(true)
  })

  test("returns false for wrapped-legacy format", async () => {
    const legacyHash = await toLegacyPasswordHash("password")
    const wrapped = await wrapLegacyHash(legacyHash)

    expect(isLegacyPasswordHash(wrapped)).toBe(false)
  })
})

describe("isWrappedLegacyHash", () => {
  test("returns true for pbkdf2-wrapped-legacy strings", async () => {
    const legacyHash = await toLegacyPasswordHash("password")
    const wrapped = await wrapLegacyHash(legacyHash)

    expect(isWrappedLegacyHash(wrapped)).toBe(true)
  })

  test("returns false for new-format pbkdf2 strings", async () => {
    const hashed = await toPasswordHash("anything")

    expect(isWrappedLegacyHash(hashed)).toBe(false)
  })

  test("returns false for raw hex strings (legacy)", () => {
    expect(
      isWrappedLegacyHash("44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247"),
    ).toBe(false)
  })
})
