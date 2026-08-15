export const invalidSystemWorkflowReasons = Object.freeze([
  "invalid_shape",
  "invalid_chronology",
  "invalid_transition",
  "duplicate_candidate",
  "candidate_excluded",
  "attestation_mismatch",
  "duplicate_attestation",
  "ineligible_decider",
  "decision_pending",
  "delegation_to_self",
  "authorization_expired",
  "authorization_already_used",
  "proposal_digest_mismatch",
])

export type InvalidSystemWorkflowReason = (typeof invalidSystemWorkflowReasons)[number]

export class InvalidSystemWorkflowError extends Error {
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
