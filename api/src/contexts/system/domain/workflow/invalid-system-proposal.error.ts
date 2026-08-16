export type InvalidSystemProposalCode =
  | "digest_mismatch"
  | "invalid_chronology"
  | "invalid_json"
  | "invalid_shape"
  | "payload_too_large"

/** Systemの手続定義または提案が不変条件を満たさない。 */
export class InvalidSystemProposalError extends Error {
  readonly code: InvalidSystemProposalCode

  constructor(code: InvalidSystemProposalCode, options?: ErrorOptions) {
    super(code, options)
    this.name = "InvalidSystemProposalError"
    this.code = code
  }
}
