import { DomainError } from "@/contexts/system/domain/errors"
import type { WorkforceIdKind } from "@/contexts/company/domain/definitions/workforce-id.definition"

export class InvalidWorkforceIdError extends DomainError {
  readonly code = "invalid_workforce_id"

  constructor(readonly kind: WorkforceIdKind) {
    super(`invalid ${kind} id`)
    this.name = "InvalidWorkforceIdError"
  }
}
