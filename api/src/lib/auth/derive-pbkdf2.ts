/** 既知のソルト・反復回数で PBKDF2 ハッシュを再計算する。検証側で使う内部ユーティリティ。 */
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
