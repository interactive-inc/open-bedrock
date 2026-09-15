import { DomainError } from "@system/domain/errors"

export type ItIncidentErrorCode =
  | "forbidden"
  | "it_incident_conflict"
  | "it_incident_unavailable"

/** ITインシデント原記録の保全操作が成立しない理由。 */
export class ItIncidentError extends DomainError {
  constructor(
    readonly code: ItIncidentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ItIncidentError"
  }
}
