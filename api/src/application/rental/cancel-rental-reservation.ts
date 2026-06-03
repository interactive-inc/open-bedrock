import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  reservationId: string
  requesterId: number
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotRequester = { reason: "not_requester" }

export type Cancelled = { reason: "cancelled" }

/**
 * レンタル予約を取消す。本人以外の取消を拒否する。
 */
export class CancelRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ReservationNotFound | NotRequester | Error> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "reservation_not_found" }
    }

    if (current.requesterId !== command.requesterId) {
      return { reason: "not_requester" }
    }

    const deleted = await reservationRepository.delete(command.reservationId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
