import { base64ToBytes } from "@/lib/auth/base64-to-bytes"

export type ParsedPbkdf2Hash = Readonly<{
  iterations: number
  salt: Uint8Array<ArrayBuffer>
  hash: Uint8Array<ArrayBuffer>
}>

/** canonical PBKDF2保存形式を厳密に解析し、不正値を認証失敗へ閉じる。 */
export function parsePbkdf2Hash(stored: string): ParsedPbkdf2Hash | null {
  const parts = stored.split(":")
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return null

  const iterations = Number.parseInt(parts[1] ?? "", 10)
  if (Number.isSafeInteger(iterations) === false || iterations <= 0) return null

  try {
    const salt = base64ToBytes(parts[2] ?? "")
    const hash = base64ToBytes(parts[3] ?? "")
    return salt.length === 0 || hash.length === 0 ? null : { iterations, salt, hash }
  } catch {
    return null
  }
}
