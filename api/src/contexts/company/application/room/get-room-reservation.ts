import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { RoomReservation } from "@/contexts/company/domain/room/room-reservation.entity"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/contexts/company/infrastructure/room/room-reservation-repository"

export type Command = {
  reservationId: string
  reserverId: number
}

/**
 * 会議室予約を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetRoomReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RoomReservation | ApplicationError> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const reservation = await reservationRepository.findById(command.reservationId)

    if (reservation instanceof Error) {
      return new UnexpectedError("failed to find reservation", { cause: reservation })
    }

    if (reservation === null) {
      return new NotFoundError("reservation not found", "reservation_not_found")
    }

    if (reservation.reserverId !== command.reserverId) {
      return new ForbiddenError("not the reserver", "not_reserver")
    }

    return reservation
  }
}
