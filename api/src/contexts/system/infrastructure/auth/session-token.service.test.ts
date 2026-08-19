import { describe, expect, test } from "bun:test"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"
import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"
import { ACCESS_TOKEN_TYPE } from "@system/domain/auth/access-token-claims"

const SECRET = "test-secret"

describe("SessionTokenService", () => {
  test("新規発行トークンはAccount主体の固定profileだけを持つ", async () => {
    const beforeMs = Date.now()
    const beforeSeconds = Math.floor(beforeMs / 1000)
    const token = await SessionTokenService.create("user-1", SECRET, 3)
    const verified = await JwtTokenService.verifyWithHeader(token, SECRET)
    const payload = await SessionTokenService.verify(token, SECRET)

    expect(verified.protectedHeader.typ).toBe(ACCESS_TOKEN_TYPE)
    expect(verified.payload.sub).toBe("user-1")
    expect(verified.payload.ver).toBe(3)
    expect(verified.payload.iss).toBe(SessionTokenService.ISSUER)
    expect(verified.payload.aud).toBe(SessionTokenService.AUDIENCE)
    expect(verified.payload.jti).toBeString()
    expect(verified.payload.userId).toBeUndefined()
    expect(verified.payload.permissions).toBeUndefined()
    expect(payload.purpose).toBe("web-session")
    expect(payload.accountId).toBe("user-1")
    expect(payload.tokenVersion).toBe(3)
    expect(payload.iat).toBeGreaterThanOrEqual(beforeSeconds)
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000))
    expect(payload.issuedAtMs).toBeGreaterThanOrEqual(beforeMs)
    expect(payload.issuedAtMs).toBeLessThanOrEqual(Date.now())
  })

  test("発行時刻を持たない旧トークンを後方互換形式へ正規化する", async () => {
    const legacyToken = await JwtTokenService.sign(
      { userId: "user-1", exp: Math.floor(Date.now() / 1000) + 60 * 60 },
      SECRET,
    )

    const payload = await SessionTokenService.verify(legacyToken, SECRET)

    expect(payload.purpose).toBe("web-session")
    expect(payload.accountId).toBe("user-1")
    expect(payload.tokenVersion).toBe(0)
    expect(payload.iat).toBeNull()
    expect(payload.issuedAtMs).toBeNull()
  })

  test("固定profileと異なるissuer・audience・typeを拒否する", async () => {
    const nowMs = Date.now()
    const nowSeconds = Math.floor(nowMs / 1000)
    const base = {
      sub: "user-1",
      ver: 0,
      purpose: "web-session",
      iss: SessionTokenService.ISSUER,
      aud: SessionTokenService.AUDIENCE,
      jti: crypto.randomUUID(),
      iat: nowSeconds,
      issuedAtMs: nowMs,
      exp: nowSeconds + 60,
    } as const

    const wrongIssuer = await JwtTokenService.sign(
      { ...base, iss: "another-issuer" },
      SECRET,
      ACCESS_TOKEN_TYPE,
    )
    const wrongAudience = await JwtTokenService.sign(
      { ...base, aud: "another-audience" },
      SECRET,
      ACCESS_TOKEN_TYPE,
    )
    const wrongType = await JwtTokenService.sign(base, SECRET, "another+jwt")

    await expect(SessionTokenService.verify(wrongIssuer, SECRET)).rejects.toThrow()
    await expect(SessionTokenService.verify(wrongAudience, SECRET)).rejects.toThrow()
    await expect(SessionTokenService.verify(wrongType, SECRET)).rejects.toThrow()
  })
})
