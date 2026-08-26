import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidIamGraphReason } from "@system/domain/errors.shared"

export class InvalidIamGraphError extends DomainError {
  readonly code = "invalid_iam_graph" as const

  constructor(readonly reason: InvalidIamGraphReason) {
    super("invalid_iam_graph")
    this.name = "InvalidIamGraphError"
    Object.freeze(this)
  }
}
