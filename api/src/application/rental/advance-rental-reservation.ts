import { canManageRentals } from "@/lib/rental/can-manage-rentals"
import { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Action = "lend" | "return"

export type Command = {
  session: SessionPayload
  reservationId: string
  action: Action
}

/**
 * 総務・人事が貸与品予約の状態を代理で進める。requested→lent、lent→returned へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RentalReservation | ApplicationError> {
    if (canManageRentals(command.session) === false) {
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

    const next = command.action === "lend" ? current.withLent() : current.withReturned()

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
