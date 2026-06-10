import type { RentalReservation } from "@/domain/rental/rental-reservation"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  reservationId: string
  requesterId: number
  itemName: string
  startDate: string
  endDate: string
  purpose: string | null
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotRequester = { reason: "not_requester" }

export type NotModifiable = { reason: "not_modifiable" }

/**
 * レンタル予約の品名・期間・用途を変更する。本人以外の変更を拒否する。
 */
export class UpdateRentalReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<RentalReservation | ReservationNotFound | NotRequester | NotModifiable | Error> {
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

    if (current.status !== "requested") {
      return { reason: "not_modifiable" }
    }

    const updated = current
      .withDetails({
        itemName: command.itemName,
        startDate: command.startDate,
        endDate: command.endDate,
      })
      .withPurpose(command.purpose)

    const result = await reservationRepository.update(updated)

    if (result instanceof Error) {
      return result
    }

    if (result === null) {
      return { reason: "not_modifiable" }
    }

    return result
  }
}
