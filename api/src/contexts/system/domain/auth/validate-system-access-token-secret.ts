/** 推測可能な署名鍵と公開済みplaceholderを拒否する。 */
export function validateSystemAccessTokenSecret(secret: string): Error | null {
  if (secret.trim().length === 0) return new Error("System access token secret is missing")
  if (secret.endsWith("-change-me")) return new Error("System access token secret is a placeholder")
  if (secret.length < 16) return new Error("System access token secret is too short")

  return null
}
