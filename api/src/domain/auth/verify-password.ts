import { isLegacyPasswordHash, toLegacyPasswordHash } from "@/domain/auth/legacy-password-hash"
import { base64ToBytes, derivePbkdf2 } from "@/domain/auth/to-password-hash"

// 平文パスワードを既存ハッシュと突き合わせて一致を判定する。
// 新形式（`pbkdf2:` プレフィックス）と旧形式（固定ソルト SHA-256 の hex 文字列）の両方を受ける。
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
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

type ParsedPbkdf2 = {
  iterations: number
  salt: Uint8Array
  hash: Uint8Array
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
