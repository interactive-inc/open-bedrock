function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

/**
 * Derives a short stable fingerprint of the lifecycle filter to bind a cursor to its query.
 */
export async function fingerprintLifecycleFilter(value: unknown): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
  )
  return base64UrlEncode(digest.slice(0, 12))
}
