import { sha256Hex } from "@/lib/crypto/sha256-hex"

/**
 * ログインの one-time code を SHA-256 でハッシュする。
 * DB には生 code を保存せずハッシュのみ格納し、漏洩時の被害を限定する。
 */
export function loginCodeHash(rawCode: string): Promise<string> {
  return sha256Hex(rawCode)
}
