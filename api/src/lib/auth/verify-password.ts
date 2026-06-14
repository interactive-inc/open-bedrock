import { isLegacyPasswordHash, toLegacyPasswordHash } from "@/lib/auth/legacy-password-hash"
import { base64ToBytes, derivePbkdf2 } from "@/lib/auth/to-password-hash"
import { isWrappedLegacyHash, WRAPPED_LEGACY_PREFIX } from "@/lib/auth/wrap-legacy-hash"

// 平文パスワードを既存ハッシュと突き合わせて一致を判定する。
// 3 形式を判別する:
//   - pbkdf2-wrapped-legacy: 旧形式ハッシュを PBKDF2 でラップした中間形式
//   - pbkdf2: 新形式（ランダムソルト PBKDF2）
//   - それ以外: 旧形式（固定ソルト SHA-256 の hex 文字列）
// いずれも定数時間比較を維持する。
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (isWrappedLegacyHash(passwordHash)) {
    return verifyWrappedLegacy(plainPassword, passwordHash)
  }

  if (isLegacyPasswordHash(passwordHash)) {
    const computed = await toLegacyPasswordHash(plainPassword)

    return constantTimeEqualString(computed, passwordHash)
  }

  const parsed = parsePbkdf2Hash(passwordHash)

  if (parsed === null) {
    return false
  }

  const computed = await derivePbkdf2(
    plainPassword,
    parsed.salt,
    parsed.iterations,
    parsed.hash.length,
  )

  return constantTimeEqualBytes(computed, parsed.hash)
}

/**
 * ラップ済み旧形式の検証: 平文 → 旧形式 hex → PBKDF2 照合。
 * hash-of-hash なので定数時間比較はバイト列レベルで行う。
 */
async function verifyWrappedLegacy(plainPassword: string, storedHash: string): Promise<boolean> {
  const parsed = parseWrappedLegacyHash(storedHash)

  if (parsed === null) {
    return false
  }

  const legacyHex = await toLegacyPasswordHash(plainPassword)

  const computed = await derivePbkdf2(legacyHex, parsed.salt, parsed.iterations, parsed.hash.length)

  return constantTimeEqualBytes(computed, parsed.hash)
}

type ParsedPbkdf2 = {
  iterations: number
  salt: Uint8Array<ArrayBuffer>
  hash: Uint8Array<ArrayBuffer>
}

// 保存フォーマット `pbkdf2:<iterations>:<base64(salt)>:<base64(hash)>` を分解する。
// フォーマット不正は null を返し、verifyPassword 側で false 扱いにする。
function parsePbkdf2Hash(stored: string): ParsedPbkdf2 | null {
  const parts = stored.split(":")

  if (parts.length !== 4) {
    return null
  }

  if (parts[0] !== "pbkdf2") {
    return null
  }

  const iterations = Number.parseInt(parts[1] ?? "", 10)

  if (Number.isFinite(iterations) === false || iterations <= 0) {
    return null
  }

  try {
    const salt = base64ToBytes(parts[2] ?? "")

    const hash = base64ToBytes(parts[3] ?? "")

    return { iterations, salt, hash }
  } catch {
    return null
  }
}

// `pbkdf2-wrapped-legacy:<iterations>:<base64(salt)>:<base64(hash)>` を分解する。
// プレフィックスにハイフンを含むため split(":") では 5 パートになる。
function parseWrappedLegacyHash(stored: string): ParsedPbkdf2 | null {
  if (stored.startsWith(WRAPPED_LEGACY_PREFIX) === false) {
    return null
  }

  const remainder = stored.slice(WRAPPED_LEGACY_PREFIX.length)
  const parts = remainder.split(":")

  if (parts.length !== 3) {
    return null
  }

  const iterations = Number.parseInt(parts[0] ?? "", 10)

  if (Number.isFinite(iterations) === false || iterations <= 0) {
    return null
  }

  try {
    const salt = base64ToBytes(parts[1] ?? "")

    const hash = base64ToBytes(parts[2] ?? "")

    return { iterations, salt, hash }
  } catch {
    return null
  }
}

// バイト列を定数時間で比較する（長さが異なる場合は即 false で OK）。
function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0

  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return diff === 0
}

// 文字列を定数時間で比較する（旧形式の hex 突き合わせ用）。
function constantTimeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0

  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return diff === 0
}
