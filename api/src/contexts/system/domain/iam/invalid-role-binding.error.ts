export const invalidRoleBindingReasons = Object.freeze([
  "invalid_shape",
  "revocation_before_creation",
  "transition_before_last_update",
] as const)

export type InvalidRoleBindingReason = (typeof invalidRoleBindingReasons)[number]

export class InvalidRoleBindingError extends Error {
  readonly code = "invalid_role_binding" as const

  constructor(
    readonly reason: InvalidRoleBindingReason,
    cause?: unknown,
  ) {
    super("invalid_role_binding", { cause })
    this.name = "InvalidRoleBindingError"
    Object.freeze(this)
  }
}
