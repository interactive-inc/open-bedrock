const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "invitetoken",
  "secret",
  "apikey",
  "authorization",
])

/**
 * オブジェクト・配列を再帰走査し、一般的な機密キーの値を監査・ログ保存前に置換する。
 * 製品固有の監査型やログSDKには依存しない。
 */
export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((element) => redactSensitiveValue(element))
  }

  if (value !== null && typeof value === "object") {
    const redactedEntries: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        redactedEntries[key] = "[redacted]"
      } else {
        redactedEntries[key] = redactSensitiveValue(child)
      }
    }

    return redactedEntries
  }

  return value
}
