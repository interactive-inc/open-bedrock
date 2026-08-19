import { describe, expect, test } from "bun:test"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"
import { MobileSessionTokenService } from "@/contexts/system/infrastructure/auth/mobile-session-token.service"
import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"
import { ACCESS_TOKEN_TYPE } from "@system/domain/auth/access-token-claims"

const SECRET = "test-secret"

describe("mobile session token", () => {
  test("モバイル用途・発行者・対象を固定して24時間トークンを発行する", async () => {
    const beforeSeconds = Math.floor(Date.now() / 1000)
    const token = await MobileSessionTokenService.create("user-1", SECRET, 4)
    const verified = await JwtTokenService.verifyWithHeader(token, SECRET)
    const payload = await MobileSessionTokenService.verify(token, SECRET)

    expect(payload.purpose).toBe("mobile-session")
    expect(verified.protectedHeader.typ).toBe(ACCESS_TOKEN_TYPE)
    expect(verified.payload.iss).toBe(MobileSessionTokenService.ISSUER)
    expect(verified.payload.aud).toBe(MobileSessionTokenService.AUDIENCE)
    expect(payload.accountId).toBe("user-1")
    expect(payload.tokenVersion).toBe(4)
    expect(payload.iat).toBeGreaterThanOrEqual(beforeSeconds)
    expect(payload.exp - payload.iat).toBe(MobileSessionTokenService.MAX_AGE_SECONDS)
  })

  test("Web session tokenをモバイルトークンとして受理しない", async () => {
    const token = await SessionTokenService.create("user-1", SECRET, 0)

    await expect(MobileSessionTokenService.verify(token, SECRET)).rejects.toThrow()
  })

  test("モバイルトークンをWeb session Cookieとして受理しない", async () => {
    const token = await MobileSessionTokenService.create("user-1", SECRET, 0)

    await expect(SessionTokenService.verify(token, SECRET)).rejects.toThrow()
  })

  test("旧JWT形式のモバイルトークンを期限内だけ正規化して受理する", async () => {
    const nowMs = Date.now()
    const nowSeconds = Math.floor(nowMs / 1000)
    const token = await JwtTokenService.sign(
      {
        purpose: "mobile-session",
        iss: MobileSessionTokenService.ISSUER,
        aud: MobileSessionTokenService.AUDIENCE,
        userId: "user-1",
        exp: nowSeconds + 60,
        iat: nowSeconds,
        issuedAtMs: nowMs,
      },
      SECRET,
    )

    const payload = await MobileSessionTokenService.verify(token, SECRET)

    expect(payload.accountId).toBe("user-1")
    expect(payload.tokenVersion).toBe(0)
  })
})
