import { DomainError } from "@system/domain/errors/domain-error.error"
import type { SystemCapabilityActivationProblem } from "@system/domain/errors.shared"

export class InvalidSystemCapabilityActivationError extends DomainError {
  readonly code = "invalid_system_capability_activation" as const
  readonly problems: ReadonlyArray<SystemCapabilityActivationProblem>

  constructor(problems: ReadonlyArray<SystemCapabilityActivationProblem>) {
    super("invalid_system_capability_activation")
    this.name = "InvalidSystemCapabilityActivationError"
    this.problems = Object.freeze(problems.map((problem) => Object.freeze({ ...problem })))
    Object.freeze(this)
  }
}
