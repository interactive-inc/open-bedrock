/**
 * 保存値が旧フォーマット（PBKDF2 プレフィックスを持たない素の hex 文字列）かを判定する。
 * pbkdf2-wrapped-legacy: も PBKDF2 系なので旧形式とはみなさない。
 */
export function isLegacyPasswordHash(storedHash: string): boolean {
  if (storedHash.startsWith("pbkdf2:")) return false

  if (storedHash.startsWith("pbkdf2-wrapped-legacy:")) return false

  return true
}
