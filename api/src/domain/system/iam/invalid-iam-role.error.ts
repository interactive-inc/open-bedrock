export const invalidIamRoleReasons = Object.freeze([
  "duplicate_permissions",
  "invalid_shape",
  "managed_role_mutation",
  "permissions_not_sorted",
  "update_before_creation",
  "update_before_last_update",
] as const)

export type InvalidIamRoleReason = (typeof invalidIamRoleReasons)[number]

export class InvalidIamRoleError extends Error {
  readonly code = "invalid_iam_role" as const

  constructor(
    readonly reason: InvalidIamRoleReason,
    cause?: unknown,
  ) {
    super("invalid_iam_role", { cause })
    this.name = "InvalidIamRoleError"
    Object.freeze(this)
  }
}
