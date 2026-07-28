export const WRAPPED_LEGACY_PREFIX = "pbkdf2-wrapped-legacy:"

/** 保存値がラップ済み旧形式かを判定する。 */
export function isWrappedLegacyHash(storedHash: string): boolean {
  return storedHash.startsWith(WRAPPED_LEGACY_PREFIX)
}
