// PBKDF2 (SHA-256) のパラメータ。Cloudflare Workers の CPU 制限内で十分なコストになる反復回数。
const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const KEY_LENGTH = 32

// 平文パスワードを PBKDF2-SHA256（ユーザー毎のランダムソルト・反復回数同梱）でハッシュ化する。
// 保存フォーマット: `pbkdf2:<iterations>:<base64(salt)>:<base64(hash)>`（PHC 風、アルゴリズム識別子あり）。
export async function toPasswordHash(plainPassword: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const hash = await derivePbkdf2(plainPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH)

  return formatPbkdf2(PBKDF2_ITERATIONS, salt, hash)
}

// 既知のソルト・反復回数で PBKDF2 ハッシュを再計算する。検証側で使う内部ユーティリティ。
export async function derivePbkdf2(
  plainPassword: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  keyLength: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder()

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(plainPassword),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
    baseKey,
    keyLength * 8,
  )

  return new Uint8Array(bits)
}

// 内部用: PBKDF2 結果を保存フォーマット文字列に変換する。
export function formatPbkdf2(iterations: number, salt: Uint8Array, hash: Uint8Array): string {
  return `pbkdf2:${iterations}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`
}

// Uint8Array を base64 文字列に変換する（Workers / Bun の標準 btoa 経由）。
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

// base64 文字列を Uint8Array に戻す。
export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)

  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}
