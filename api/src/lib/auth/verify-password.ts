import { constantTimeEqualBytes } from "@/lib/auth/constant-time-equal-bytes"
import { derivePbkdf2 } from "@/lib/auth/derive-pbkdf2"
import { parsePbkdf2Hash } from "@/lib/auth/parse-pbkdf2-hash"

/** 平文パスワードをcanonical PBKDF2 hashと照合する。未知形式は認証失敗へ閉じる。 */
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  const parsed = parsePbkdf2Hash(passwordHash)
  if (parsed === null) return false

  const computed = await derivePbkdf2(
    plainPassword,
    parsed.salt,
    parsed.iterations,
    parsed.hash.length,
  )
  return constantTimeEqualBytes(computed, parsed.hash)
}
