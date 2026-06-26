import type { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  reservationId: string
  requesterId: number
}

/**
 * レンタル予約を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RentalReservation | ApplicationError> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const reservation = await reservationRepository.findById(command.reservationId)

    if (reservation instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: reservation })
    }

    if (reservation === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (reservation.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return reservation
  }
}
