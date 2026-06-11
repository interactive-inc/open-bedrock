import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
}

export type ReservationNotFound = { reason: "reservation_not_found" }

export type Cancelled = { reason: "cancelled" }

/**
 * 会議室予約をキャンセルする。所有権チェックと削除をアトミックに行う。
 */
export class CancelRoomReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ReservationNotFound | Error> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const deleted = await reservationRepository.deleteByIdAndReserverId(
      command.reservationId,
      command.reserverId,
    )

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "reservation_not_found" }
    }

    return { reason: "cancelled" }
  }
}
