import type { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotReserver = { reason: "not_reserver" }

/**
 * 会議室予約を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetRoomReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<RoomReservation | ReservationNotFound | NotReserver | Error> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const reservation = await reservationRepository.findById(command.reservationId)

    if (reservation instanceof Error) {
      return reservation
    }

    if (reservation === null) {
      return { reason: "reservation_not_found" }
    }

    if (reservation.reserverId !== command.reserverId) {
      return { reason: "not_reserver" }
    }

    return reservation
  }
}
