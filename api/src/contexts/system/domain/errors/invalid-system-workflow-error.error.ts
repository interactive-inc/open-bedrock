import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidSystemWorkflowReason } from "@system/domain/errors.shared"

export class InvalidSystemWorkflowError extends DomainError {
  readonly code = "invalid_system_workflow"

  constructor(
    readonly reason: InvalidSystemWorkflowReason,
    cause?: unknown,
  ) {
    super("invalid_system_workflow", { cause })
    this.name = "InvalidSystemWorkflowError"
    Object.freeze(this)
  }
}
