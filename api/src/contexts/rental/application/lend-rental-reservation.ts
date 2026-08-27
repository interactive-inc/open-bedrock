import type { Session } from "@/lib/auth/session"
import { RentalReservation } from "@/contexts/rental/domain/entities/rental-reservation.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/repositories/rental-reservation.repository"

export type Command = {
  session: Session
  reservationId: string
}

/** 貸与品を貸し出す。 */
export class LendRentalReservation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<RentalReservation | ApplicationError> {
    if (command.session.hasPermission("rental:manage") === false) {
      return new ForbiddenError("cannot manage rental reservations", "forbidden")
    }

    const rentalReservationRepository = new RentalReservationRepository(this.c)

    const current = await rentalReservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find rental reservation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("rental reservation not found", "rental_reservation_not_found")
    }

    const next = current.withLent()

    if (next instanceof RentalReservation === false) {
      return new ConflictError("rental reservation is not in a transitionable state", next.reason)
    }

    const updated = await rentalReservationRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update rental reservation status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError(
        "rental reservation is not in a transitionable state",
        "invalid_transition",
      )
    }

    return updated
  }
}
