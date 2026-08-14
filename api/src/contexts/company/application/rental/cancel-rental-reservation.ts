import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/contexts/company/infrastructure/rental/rental-reservation-repository"

export type Command = {
  reservationId: string
  requesterId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * レンタル予約を取消す。本人以外の取消を拒否する。
 */
export class CancelRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("reservation is not modifiable", "not_modifiable")
    }

    const deleted = await reservationRepository.delete(command.reservationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete reservation", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("reservation is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  }
}
