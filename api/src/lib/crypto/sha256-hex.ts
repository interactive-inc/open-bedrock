/**
 * 文字列を SHA-256 でハッシュし、16 進文字列で返す。
 * 生トークン・生コードを DB に保存する代わりにこのハッシュだけを格納し、漏洩時の被害を限定する用途で使う。
 */
export async function sha256Hex(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw)

  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)

  const hashArray = Array.from(new Uint8Array(hashBuffer))

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
