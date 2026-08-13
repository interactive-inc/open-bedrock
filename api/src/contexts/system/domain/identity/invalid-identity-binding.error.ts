export const invalidIdentityBindingReasons = Object.freeze([
  "activation_before_creation",
  "invalid_shape",
  "revocation_before_activation",
  "revocation_before_creation",
  "revoked_identity_activation",
] as const)

export type InvalidIdentityBindingReason = (typeof invalidIdentityBindingReasons)[number]

export class InvalidIdentityBindingError extends Error {
  readonly code = "invalid_identity_binding" as const

  constructor(
    readonly reason: InvalidIdentityBindingReason,
    cause?: unknown,
  ) {
    super("invalid_identity_binding", { cause })
    this.name = "InvalidIdentityBindingError"
    Object.freeze(this)
  }
}
