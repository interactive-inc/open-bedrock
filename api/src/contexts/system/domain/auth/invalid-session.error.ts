export const invalidSessionReasons = Object.freeze([
  "expiration_not_after_creation",
  "expired",
  "invalid_clock",
  "invalid_rotation_successor",
  "invalid_shape",
  "not_yet_valid",
  "revocation_before_creation",
  "revocation_before_rotation",
  "revoked",
  "rotated",
  "rotation_at_or_after_expiration",
  "rotation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidSessionReason = (typeof invalidSessionReasons)[number]

export class InvalidSessionError extends Error {
  readonly code = "invalid_session" as const

  constructor(
    readonly reason: InvalidSessionReason,
    cause?: unknown,
  ) {
    super("invalid_session", { cause })
    this.name = "InvalidSessionError"
    Object.freeze(this)
  }
}
