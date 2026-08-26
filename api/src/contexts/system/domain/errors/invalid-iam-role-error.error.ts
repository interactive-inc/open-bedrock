import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidIamRoleReason } from "@system/domain/errors.shared"

export class InvalidIamRoleError extends DomainError {
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
