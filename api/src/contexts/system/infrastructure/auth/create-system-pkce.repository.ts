import { generateOpaqueToken } from "@system/infrastructure/auth/generate-opaque-token.repository"
import { toPkceS256Challenge } from "@system/infrastructure/auth/to-pkce-s256-challenge.repository"

/** RFC 7636 S256のverifierとchallengeを暗号学的乱数から生成する。 */
export async function createSystemPkce(): Promise<
  Readonly<{ verifier: string; challenge: string }>
> {
  const verifier = generateOpaqueToken()
  return { verifier, challenge: await toPkceS256Challenge(verifier) }
}
