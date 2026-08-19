function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

export class OidcCryptographyService {
  static createSecret(): string {
    return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  }

  static async hashSecret(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  static async createPkceChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))

    return toBase64Url(new Uint8Array(digest))
  }
}
