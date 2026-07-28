import { sha256Hex } from "@/lib/crypto/sha256-hex"

/**
 * リフレッシュトークンの生トークンを SHA-256 でハッシュする。
 * DB には生トークンを保存せずハッシュのみ格納し、漏洩時の被害を限定する。
 */
export function refreshTokenHash(rawToken: string): Promise<string> {
  return sha256Hex(rawToken)
}
