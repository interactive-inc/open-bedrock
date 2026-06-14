import type { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  reservationId: string
  requesterId: number
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotRequester = { reason: "not_requester" }

/**
 * レンタル予約を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetRentalReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<RentalReservation | ReservationNotFound | NotRequester | Error> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const reservation = await reservationRepository.findById(command.reservationId)

    if (reservation instanceof Error) {
      return reservation
    }

    if (reservation === null) {
      return { reason: "reservation_not_found" }
    }

    if (reservation.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    return reservation
  }
}
