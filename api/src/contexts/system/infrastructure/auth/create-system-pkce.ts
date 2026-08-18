import { generateOpaqueToken } from "@system/infrastructure/auth/generate-opaque-token"
import { toPkceS256Challenge } from "@system/infrastructure/auth/pkce-s256"

/** RFC 7636 S256のverifierとchallengeを暗号学的乱数から生成する。 */
export async function createSystemPkce(): Promise<
  Readonly<{ verifier: string; challenge: string }>
> {
  const verifier = generateOpaqueToken()
  return { verifier, challenge: await toPkceS256Challenge(verifier) }
}
