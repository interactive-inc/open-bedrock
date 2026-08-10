import { toPkceS256Challenge } from "@/infrastructure/system/auth/pkce-s256"
import { base64url } from "jose"

export type Pkce = {
  verifier: string
  challenge: string
}

/** RFC 7636のS256方式でverifierとchallengeを生成する。 */
export async function createPkce(): Promise<Pkce> {
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(32)))

  return { verifier, challenge: await toPkceS256Challenge(verifier) }
}
