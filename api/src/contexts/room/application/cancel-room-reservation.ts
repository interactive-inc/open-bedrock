import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
}

export type Cancelled = { reason: "cancelled" }

/**
 * 会議室予約をキャンセルする。所有権チェックと削除をアトミックに行う。
 */
export class CancelRoomReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Cancelled | ApplicationError> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const deleted = await reservationRepository.deleteByIdAndReserverId(
      command.reservationId,
      command.reserverId,
    )

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete reservation", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    return { reason: "cancelled" }
  }
}
