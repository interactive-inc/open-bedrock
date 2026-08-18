import type { WorkforceIdKind } from "@/contexts/company/domain/workforce/workforce-id"

export class InvalidWorkforceIdError extends Error {
  readonly code = "invalid_workforce_id"

  constructor(readonly kind: WorkforceIdKind) {
    super(`invalid ${kind} id`)
    this.name = "InvalidWorkforceIdError"
  }
}
