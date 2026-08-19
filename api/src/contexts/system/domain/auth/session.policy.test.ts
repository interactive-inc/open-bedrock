import { describe, expect, test } from "bun:test"
import { SessionPolicy } from "@/contexts/system/domain/auth/session.policy"

describe("SessionPolicy", () => {
  test("Bearerヘッダだけからトークンを取り出す", () => {
    expect(SessionPolicy.bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi")
    expect(SessionPolicy.bearerToken("bearer token")).toBe("token")
    expect(SessionPolicy.bearerToken("Basic abc")).toBeUndefined()
    expect(SessionPolicy.bearerToken("Bearer")).toBeUndefined()
    expect(SessionPolicy.bearerToken(undefined)).toBeUndefined()
  })

  test("壊れたtokenを含むBearer schemeも検出する", () => {
    expect(SessionPolicy.hasBearerAuthorization("Bearer token")).toBe(true)
    expect(SessionPolicy.hasBearerAuthorization("bearer")).toBe(true)
    expect(SessionPolicy.hasBearerAuthorization("Bearer ")).toBe(true)
  })

  test("別schemeとBearerに見えるだけの値は検出しない", () => {
    expect(SessionPolicy.hasBearerAuthorization(undefined)).toBe(false)
    expect(SessionPolicy.hasBearerAuthorization("Basic token")).toBe(false)
    expect(SessionPolicy.hasBearerAuthorization("BearerX token")).toBe(false)
  })

  test("パスワード変更より前の session を失効させる", () => {
    const passwordChangedAt = new Date("2026-01-01T00:00:00.500Z")

    expect(
      SessionPolicy.isRevokedByPasswordChange({
        issuedAtSeconds: 1_767_225_600,
        issuedAtMs: 1_767_225_600_499,
        passwordChangedAt,
      }),
    ).toBe(true)
    expect(
      SessionPolicy.isRevokedByPasswordChange({
        issuedAtSeconds: 1_767_225_600,
        issuedAtMs: 1_767_225_600_501,
        passwordChangedAt,
      }),
    ).toBe(false)
  })

  test("発行時刻の無い旧 token は変更履歴がある場合だけ失効させる", () => {
    expect(
      SessionPolicy.isRevokedByPasswordChange({
        issuedAtSeconds: null,
        passwordChangedAt: new Date(),
      }),
    ).toBe(true)
    expect(
      SessionPolicy.isRevokedByPasswordChange({
        issuedAtSeconds: null,
        passwordChangedAt: null,
      }),
    ).toBe(false)
  })

  test("refresh 間隔を超えた session と発行時刻不明の旧 token を更新対象にする", () => {
    expect(
      SessionPolicy.shouldRefresh({
        payload: { iat: null, issuedAtMs: 1_000 },
        nowMs: 2_000,
        refreshAfterSeconds: 1,
      }),
    ).toBe(true)
    expect(
      SessionPolicy.shouldRefresh({
        payload: { iat: null, issuedAtMs: null },
        nowMs: 2_000,
        refreshAfterSeconds: 1,
      }),
    ).toBe(true)
  })
})
