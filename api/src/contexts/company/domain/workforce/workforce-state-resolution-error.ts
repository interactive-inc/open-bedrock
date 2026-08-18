export type WorkforceStateResolutionCode =
  | "employment_state_ambiguous"
  | "status_state_missing"
  | "status_state_ambiguous"
  | "primary_assignment_state_ambiguous"

export class WorkforceStateResolutionError extends Error {
  constructor(readonly code: WorkforceStateResolutionCode) {
    super(code)
    this.name = "WorkforceStateResolutionError"
  }
}
