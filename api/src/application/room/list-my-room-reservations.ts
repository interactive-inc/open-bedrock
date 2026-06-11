import type { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

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

  async run(command: Command): Promise<ReadonlyArray<RoomReservation> | Error> {
    const reservationRepository = new RoomReservationRepository(this.c)

    return await reservationRepository.findByReserverId(command.reserverId, {
      limit: command.limit,
      offset: command.offset,
    })
  }
}
