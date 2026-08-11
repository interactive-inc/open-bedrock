export const invalidAccountReasons = Object.freeze([
  "invalid_shape",
  "token_version_exhausted",
  "transition_before_last_update",
  "update_before_creation",
] as const)

export type InvalidAccountReason = (typeof invalidAccountReasons)[number]

export class InvalidAccountError extends Error {
  readonly code = "invalid_account" as const

  constructor(
    readonly reason: InvalidAccountReason,
    cause?: unknown,
  ) {
    super("invalid_account", { cause })
    this.name = "InvalidAccountError"
    Object.freeze(this)
  }
}
