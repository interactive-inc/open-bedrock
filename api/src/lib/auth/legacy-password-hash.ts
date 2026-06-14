// 旧フォーマット用に保持する固定ソルト SHA-256 のハッシュ計算。
// 段階移行（旧形式で検証成功 → 新形式で再ハッシュして書き戻し）にのみ使う。
// 新規ハッシュ生成では使わない。

const LEGACY_SALT = "open-karte-static-salt"

// 旧仕様: `SHA256("open-karte-static-salt:" + plainPassword)` を 16 進文字列で返す。
export async function toLegacyPasswordHash(plainPassword: string): Promise<string> {
  const encoder = new TextEncoder()

  const saltedBytes = encoder.encode(`${LEGACY_SALT}:${plainPassword}`)

  const digest = await crypto.subtle.digest("SHA-256", saltedBytes)

  const bytes = Array.from(new Uint8Array(digest))

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

// 保存値が旧フォーマット（PBKDF2 プレフィックスを持たない素の hex 文字列）かを判定する。
// pbkdf2-wrapped-legacy: も PBKDF2 系なので旧形式とはみなさない。
export function isLegacyPasswordHash(storedHash: string): boolean {
  if (storedHash.startsWith("pbkdf2:")) return false

  if (storedHash.startsWith("pbkdf2-wrapped-legacy:")) return false

  return true
}
