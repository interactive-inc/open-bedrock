import { bytesToBase64, derivePbkdf2 } from "@/lib/auth/to-password-hash"

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const KEY_LENGTH = 32

export const WRAPPED_LEGACY_PREFIX = "pbkdf2-wrapped-legacy:"

/**
 * 旧形式ハッシュ（固定ソルト SHA-256 の hex 文字列）を PBKDF2 でラップした保存文字列を生成する。
 * ユーザーの平文パスワードなしでオフライン移行できる hash-of-hash 方式で、
 * フォーマットは `pbkdf2-wrapped-legacy:<iterations>:<base64(salt)>:<base64(hash)>`。
 * 検証時は平文から旧形式ハッシュを再計算し、その hex を PBKDF2 の入力として照合する。
 * ログイン時に純正 PBKDF2（toPasswordHash）へ昇格されるまでの中間形式
 */
export async function wrapLegacyHash(legacyHexHash: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const hash = await derivePbkdf2(legacyHexHash, salt, PBKDF2_ITERATIONS, KEY_LENGTH)

  return `pbkdf2-wrapped-legacy:${PBKDF2_ITERATIONS}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`
}

/** 保存値がラップ済み旧形式かを判定する。 */
export function isWrappedLegacyHash(storedHash: string): boolean {
  return storedHash.startsWith(WRAPPED_LEGACY_PREFIX)
}
