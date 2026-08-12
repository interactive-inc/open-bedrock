export type SystemCapabilityActivationProblem = Readonly<{
  code:
    | "capability_not_implemented"
    | "duplicate_enabled_capability"
    | "duplicate_implemented_capability"
    | "invalid_activation_shape"
    | "missing_required_activation"
    | "missing_required_implementation"
    | "unknown_enabled_capability"
    | "unknown_implemented_capability"
  capability: string | null
}>

export class InvalidSystemCapabilityActivationError extends Error {
  readonly code = "invalid_system_capability_activation" as const
  readonly problems: ReadonlyArray<SystemCapabilityActivationProblem>

  constructor(problems: ReadonlyArray<SystemCapabilityActivationProblem>) {
    super("invalid_system_capability_activation")
    this.name = "InvalidSystemCapabilityActivationError"
    this.problems = Object.freeze(problems.map((problem) => Object.freeze({ ...problem })))
    Object.freeze(this)
  }
}
