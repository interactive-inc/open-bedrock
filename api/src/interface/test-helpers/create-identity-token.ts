import { SignJWT } from "jose"

import type { KeyLike } from "jose"

/**
 * テスト用: 外部 identity provider が発行する短命ログイントークン(EdDSA JWT)を作る。
 * 既定は正常系の claims。各フィールドやヘッダ(alg)を上書きして異常系も作れる。
 */
export type IdentityTokenOverrides = {
  sub?: string
  email?: string
  emailVerified?: boolean
  name?: string
  jti?: string
  issuer?: string
  audience?: string
  /** 発行時刻(epoch 秒)。既定は now。 */
  iat?: number
  /** 失効時刻(epoch 秒)。既定は now + 60。 */
  exp?: number
  /** 署名アルゴリズム。既定はEdDSA。異常系検証用に上書きできる。 */
  alg?: string
  keyId?: string
}

export function createIdentityToken(
  signingKey: KeyLike | Uint8Array,
  nowEpoch: number,
  overrides: IdentityTokenOverrides = {},
): Promise<string> {
  const claims = {
    sub: overrides.sub ?? "external-subject-1",
    email: overrides.email ?? "you+ext@example.com",
    email_verified: overrides.emailVerified ?? true,
    name: overrides.name ?? "External Worker",
    jti: overrides.jti ?? "token-jti-1",
  }

  return new SignJWT(claims)
    .setProtectedHeader({
      alg: overrides.alg ?? "EdDSA",
      kid: overrides.keyId ?? "identity-test-key",
    })
    .setIssuer(overrides.issuer ?? "https://identity-provider.example/")
    .setAudience(overrides.audience ?? "open-karte")
    .setIssuedAt(overrides.iat ?? nowEpoch)
    .setExpirationTime(overrides.exp ?? nowEpoch + 60)
    .sign(signingKey)
}
