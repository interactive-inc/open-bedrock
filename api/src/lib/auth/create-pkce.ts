import { base64url } from "jose"

export type Pkce = {
  verifier: string
  challenge: string
}

/**
 * RFC 7636 S256用のverifierとchallengeを生成する。
 */
export async function createPkce(): Promise<Pkce> {
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))

  return { verifier, challenge: base64url.encode(new Uint8Array(digest)) }
}
