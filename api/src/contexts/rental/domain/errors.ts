import { DomainError } from "@system/domain/errors"

export type RentalReservationErrorCode =
  | "forbidden"
  | "rental_reservation_conflict"
  | "rental_reservation_unavailable"

/** rental reservation原記録の保全操作が成立しない理由。 */
export class RentalReservationError extends DomainError {
  constructor(
    readonly code: RentalReservationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "RentalReservationError"
  }
}
