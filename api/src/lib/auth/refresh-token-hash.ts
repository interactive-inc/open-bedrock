/**
 * リフレッシュトークンの生トークンを SHA-256 でハッシュする。
 * DB には生トークンを保存せずハッシュのみ格納し、漏洩時の被害を限定する。
 */
export async function refreshTokenHash(rawToken: string): Promise<string> {
  const encoded = new TextEncoder().encode(rawToken)

  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)

  const hashArray = Array.from(new Uint8Array(hashBuffer))

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
