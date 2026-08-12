function toUnpaddedBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

/** RFC 7636のS256方式でverifierからchallengeを導出する。 */
export async function toPkceS256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))

  return toUnpaddedBase64Url(new Uint8Array(digest))
}

/** S256 challengeの正準表現とverifierの組み合わせを検証する。 */
export async function verifyPkceS256Challenge(
  verifier: string,
  challenge: string,
): Promise<boolean> {
  return (await toPkceS256Challenge(verifier)) === challenge
}
