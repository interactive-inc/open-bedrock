import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type NotReserver = { reason: "not_reserver" }

export type Cancelled = { reason: "cancelled" }

/**
 * 会議室予約をキャンセルする。本人以外のキャンセルを拒否する。
 */
export class CancelRoomReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ReservationNotFound | NotReserver | Error> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const current = await reservationRepository.findById(command.reservationId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "reservation_not_found" }
    }

    if (current.reserverId !== command.reserverId) {
      return { reason: "not_reserver" }
    }

    const deleted = await reservationRepository.delete(command.reservationId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "cancelled" }
  }
}
