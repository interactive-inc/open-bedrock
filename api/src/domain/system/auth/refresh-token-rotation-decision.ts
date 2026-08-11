export const refreshTokenRotationDecisions = Object.freeze([
  "rotated",
  "reused",
  "invalid",
] as const)

export type RefreshTokenRotationDecision = (typeof refreshTokenRotationDecisions)[number]

/** Untrusted storage results are accepted only when they match the closed System vocabulary. */
export function parseRefreshTokenRotationDecision(
  value: unknown,
): RefreshTokenRotationDecision | null {
  return refreshTokenRotationDecisions.find((decision) => decision === value) ?? null
}

/** Audited atomic adapters must provide one case for every possible rotation outcome. */
export function hasExactRefreshTokenRotationDecisions(
  values: readonly unknown[],
): values is readonly RefreshTokenRotationDecision[] {
  return (
    values.length === refreshTokenRotationDecisions.length &&
    new Set(values).size === refreshTokenRotationDecisions.length &&
    values.every((value) => parseRefreshTokenRotationDecision(value) !== null)
  )
}
