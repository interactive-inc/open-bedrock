/** 公開例示値や短い値をbootstrap credentialとして受理しない。 */
export function isSystemBootstrapTokenUsable(token: string | undefined): boolean {
  if (token === undefined || token.length < 16) return false

  const normalized = token.toLowerCase()

  return (
    !normalized.includes("change-me") &&
    !normalized.includes("changeme") &&
    !normalized.includes("example") &&
    !normalized.includes("placeholder")
  )
}
