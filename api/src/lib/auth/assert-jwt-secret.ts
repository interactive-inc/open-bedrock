import { isPlaceholderSecret } from "@/lib/config/is-placeholder-secret"
import { UnavailableError } from "@/lib/errors"

/** 総当たりが現実的になる長さの下限。推奨は `openssl rand -base64 32` で得る 32 文字以上。 */
const MINIMUM_LENGTH = 16

/**
 * 署名鍵として使えない JWT_SECRET を拒否する。
 *
 * HS256 は署名鍵と検証鍵が同一なので、この値が推測できれば任意の accountId と
 * tokenVersion を持つアクセストークンを偽造できる（= 全権限の掌握）。
 * 未設定・空白・公開済みの例示値・極端に短い値をすべて失敗にする。
 */
export function assertJwtSecret(secret: string): void {
  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new UnavailableError("JWT secret is not configured", "jwt_secret_invalid")
  }

  if (isPlaceholderSecret(secret)) {
    throw new UnavailableError(
      "JWT secret is still the published example value",
      "jwt_secret_invalid",
    )
  }

  if (secret.length < MINIMUM_LENGTH) {
    throw new UnavailableError("JWT secret is too short", "jwt_secret_invalid")
  }
}
