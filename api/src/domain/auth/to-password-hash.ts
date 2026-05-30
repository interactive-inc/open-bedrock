const passwordSalt = "open-karte-static-salt"

// 平文パスワードを固定ソルト付き SHA-256 でハッシュ化する純粋関数。
export async function toPasswordHash(plainPassword: string): Promise<string> {
  const encoder = new TextEncoder()

  const saltedBytes = encoder.encode(`${passwordSalt}:${plainPassword}`)

  const digest = await crypto.subtle.digest("SHA-256", saltedBytes)

  const bytes = Array.from(new Uint8Array(digest))

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
