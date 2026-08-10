import { describe, expect, test } from "bun:test"
import {
  createAccessTokenService,
  type AccessTokenProfile,
} from "@/infrastructure/system/auth/access-token.service"

const SECRET = "shared-test-secret"
const PROFILE = Object.freeze({
  issuer: "system-test",
  audience: "system-test-api",
  purpose: "api-session",
  maxAgeSeconds: 60,
}) satisfies AccessTokenProfile

describe("AccessTokenService", () => {
  test("Accountだけを主体にして固定profileの短命tokenを往復する", async () => {
    const service = createAccessTokenService(PROFILE)
    const claims = await service.verify(
      await service.create({ accountId: "account-1", tokenVersion: 7 }, SECRET),
      SECRET,
    )

    expect(String(claims.sub)).toBe("account-1")
    expect(claims.ver).toBe(7)
    expect(claims.iss).toBe(PROFILE.issuer)
    expect(claims.aud).toBe(PROFILE.audience)
    expect(claims.purpose).toBe(PROFILE.purpose)
    expect(claims.exp - claims.iat).toBe(PROFILE.maxAgeSeconds)
    expect(claims.jti).toBeString()
    expect(Object.keys(claims).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "issuedAtMs", "jti", "purpose", "sub", "ver"].sort(),
    )
  })

  test("issuer・audience・purpose・最大寿命が違うprofile間ではtokenを流用できない", async () => {
    const source = createAccessTokenService({ ...PROFILE, maxAgeSeconds: 120 })
    const token = await source.create({ accountId: "account-1", tokenVersion: 0 }, SECRET)
    const mismatches = [
      createAccessTokenService(PROFILE),
      createAccessTokenService({ ...PROFILE, issuer: "another-system", maxAgeSeconds: 120 }),
      createAccessTokenService({ ...PROFILE, audience: "another-api", maxAgeSeconds: 120 }),
      createAccessTokenService({ ...PROFILE, purpose: "web-session", maxAgeSeconds: 120 }),
    ]

    for (const service of mismatches) {
      expect(
        await service.verify(token, SECRET).then(
          () => false,
          () => true,
        ),
      ).toBe(true)
    }
  })

  test("空のsecretと不正なprofileをfail closedで拒否する", async () => {
    const service = createAccessTokenService(PROFILE)

    expect(
      await service.create({ accountId: "account-1", tokenVersion: 0 }, "").then(
        () => false,
        () => true,
      ),
    ).toBe(true)
    expect(() => createAccessTokenService({ ...PROFILE, maxAgeSeconds: 0 })).toThrow()
  })

  test("共通opaque ID契約の範囲外にあるAccount IDを拒否する", async () => {
    const service = createAccessTokenService(PROFILE)

    expect(
      await service.create({ accountId: "a".repeat(256), tokenVersion: 0 }, SECRET).then(
        () => false,
        () => true,
      ),
    ).toBe(true)
  })
})
