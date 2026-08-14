import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { RoomReservation } from "@/contexts/company/domain/room/room-reservation.entity"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/contexts/company/infrastructure/room/room-reservation-repository"

export type Command = {
  reserverId: number
  limit: number
  offset: number
}

/**
 * 予約者本人の会議室予約を一覧する。
 */
export class ListMyRoomReservations {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<RoomReservation> | ApplicationError> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const reservations = await reservationRepository.findByReserverId(command.reserverId, {
      limit: command.limit,
      offset: command.offset,
    })

    if (reservations instanceof Error) {
      return new UnexpectedError("failed to find reservations", { cause: reservations })
    }

    return reservations
  }
}
