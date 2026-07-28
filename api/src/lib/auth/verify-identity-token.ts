import { jwtVerify } from "jose"
import { z } from "zod"

import type { JWTVerifyGetKey } from "jose"

/**
 * 外部 identity provider が発行する短命ログイントークン(EdDSA JWT)の claims。
 * email_verified が false のトークンは拒否対象だが、claims 検証段階では形だけ確認する。
 */
export const identityTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1).max(254),
  email_verified: z.boolean(),
  name: z.string().min(1).max(200),
  iat: z.number(),
  exp: z.number(),
  jti: z.string().min(1),
})

export type IdentityTokenClaims = z.infer<typeof identityTokenClaimsSchema>

export type VerifyIdentityTokenInput = {
  token: string
  verificationKey: JWTVerifyGetKey
  issuer: string
  audience: string
  /** exp/iat の検証基準時刻。アプリの時刻注入(NOW)と一致させ、決定的に検証する。 */
  now: Date
}

export type IdentityTokenError = {
  reason: "invalid_token"
}

/**
 * 外部 identity トークンを検証する。以下すべてを満たさなければ invalid_token を返す。
 * - EdDSA署名がissuerの公開JWKSで検証できる
 * - iss が期待値と一致する
 * - aud が期待値と一致する
 * - exp が未失効（jose が iat/exp を検証）
 * - claims の形（sub/email/email_verified/name/iat/exp/jti）が揃っている
 *
 * 検証成功時は claims を返す。email_verified の可否・replay 判定は呼び出し側の責務。
 */
export async function verifyIdentityToken(
  input: VerifyIdentityTokenInput,
): Promise<IdentityTokenClaims | IdentityTokenError> {
  try {
    const verified = await jwtVerify(input.token, input.verificationKey, {
      algorithms: ["EdDSA"],
      issuer: input.issuer,
      audience: input.audience,
      currentDate: input.now,
    })

    const parsed = identityTokenClaimsSchema.safeParse(verified.payload)

    if (!parsed.success) {
      return { reason: "invalid_token" }
    }

    return parsed.data
  } catch {
    return { reason: "invalid_token" }
  }
}
