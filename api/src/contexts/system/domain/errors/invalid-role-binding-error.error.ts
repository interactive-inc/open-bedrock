import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidRoleBindingReason } from "@system/domain/errors.shared"

export class InvalidRoleBindingError extends DomainError {
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
