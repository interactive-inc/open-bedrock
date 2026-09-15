import { DomainError } from "@system/domain/errors"

export type BusinessTripErrorCode =
  | "forbidden"
  | "business_trip_conflict"
  | "business_trip_unavailable"

/** 出張申請原記録の保全操作が成立しない理由。 */
export class BusinessTripError extends DomainError {
  constructor(
    readonly code: BusinessTripErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "BusinessTripError"
  }
}
