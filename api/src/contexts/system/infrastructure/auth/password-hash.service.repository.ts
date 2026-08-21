const ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000
const SALT_BYTES = 16
const HASH_BYTES = 32

type ParsedHash = Readonly<{
  iterations: number
  salt: Uint8Array<ArrayBuffer>
  hash: Uint8Array<ArrayBuffer>
}>

export class PasswordHashService {
  static async hash(password: string, pepper: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const peppered = await PasswordHashService.applyPepper(password, pepper)
    const hash = await PasswordHashService.derive(peppered, salt, ITERATIONS)

    return `pbkdf2$sha256$${ITERATIONS}$${PasswordHashService.toBase64(salt)}$${PasswordHashService.toBase64(hash)}`
  }

  static async verify(password: string, stored: string, pepper: string): Promise<boolean> {
    const parsed = PasswordHashService.parseStored(stored)

    if (parsed === null) {
      return false
    }

    const peppered = await PasswordHashService.applyPepper(password, pepper)
    const candidate = await PasswordHashService.derive(peppered, parsed.salt, parsed.iterations)

    return PasswordHashService.equalBytes(candidate, parsed.hash)
  }

  static needsRehash(stored: string): boolean {
    const parsed = PasswordHashService.parseStored(stored)
    return parsed === null || parsed.iterations < ITERATIONS
  }

  private static async applyPepper(
    password: string,
    pepper: string,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const encoder = new TextEncoder()
    const pepperKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const signature = await crypto.subtle.sign("HMAC", pepperKey, encoder.encode(password))
    return new Uint8Array(signature)
  }

  private static async derive(
    pepperedPassword: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      pepperedPassword,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    )
    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      baseKey,
      HASH_BYTES * 8,
    )
    return new Uint8Array(derived)
  }

  private static parseStored(stored: string): ParsedHash | null {
    const parts = stored.split("$")

    if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
      return null
    }

    const iterations = Number.parseInt(parts[2]!, 10)

    if (!Number.isFinite(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) {
      return null
    }

    const salt = PasswordHashService.safeFromBase64(parts[3]!)
    const hash = PasswordHashService.safeFromBase64(parts[4]!)

    if (
      salt === null ||
      salt.length !== SALT_BYTES ||
      hash === null ||
      hash.length !== HASH_BYTES
    ) {
      return null
    }

    return { iterations, salt, hash }
  }

  private static safeFromBase64(encoded: string): Uint8Array<ArrayBuffer> | null {
    try {
      const binary = atob(encoded)
      const bytes = new Uint8Array(binary.length)

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }

      return bytes
    } catch {
      return null
    }
  }

  private static toBase64(bytes: Uint8Array<ArrayBuffer>): string {
    let binary = ""

    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }

    return btoa(binary)
  }

  private static equalBytes(
    left: Uint8Array<ArrayBuffer>,
    right: Uint8Array<ArrayBuffer>,
  ): boolean {
    if (left.length !== right.length) {
      return false
    }

    let difference = 0

    for (let index = 0; index < left.length; index += 1) {
      difference |= left[index]! ^ right[index]!
    }

    return difference === 0
  }
}
