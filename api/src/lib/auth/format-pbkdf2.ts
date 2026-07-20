import { bytesToBase64 } from "@/lib/auth/bytes-to-base64"

/** PBKDF2 結果を保存フォーマット文字列 `pbkdf2:<iterations>:<base64(salt)>:<base64(hash)>` に変換する。 */
export function formatPbkdf2(iterations: number, salt: Uint8Array, hash: Uint8Array): string {
  return `pbkdf2:${iterations}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`
}
