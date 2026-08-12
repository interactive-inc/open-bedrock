export const invalidIamGraphReasons = Object.freeze([
  "duplicate_binding_id",
  "duplicate_role_id",
  "invalid_shape",
  "unknown_binding_role",
] as const)

export type InvalidIamGraphReason = (typeof invalidIamGraphReasons)[number]

export class InvalidIamGraphError extends Error {
  readonly code = "invalid_iam_graph" as const

  constructor(readonly reason: InvalidIamGraphReason) {
    super("invalid_iam_graph")
    this.name = "InvalidIamGraphError"
    Object.freeze(this)
  }
}
