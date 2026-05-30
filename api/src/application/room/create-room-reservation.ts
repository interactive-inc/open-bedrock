import { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"

export type Command = {
  roomId: number
  reserverId: number
  startAt: string
  endAt: string
  purpose: string | null
}

export type RoomAlreadyReserved = { reason: "room_already_reserved" }

/**
 * 会議室を予約する。重複時は判別可能な失敗を返す。
 */
export class CreateRoomReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RoomReservation | RoomAlreadyReserved | Error> {
    const reservationRepository = new RoomReservationRepository(this.c)

    const overlapping = await reservationRepository.findOverlapping({
      roomId: command.roomId,
      startAt: command.startAt,
      endAt: command.endAt,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "room_already_reserved" }
    }

    const reservation = RoomReservation.create({
      roomId: command.roomId,
      reserverId: command.reserverId,
      startAt: command.startAt,
      endAt: command.endAt,
      purpose: command.purpose,
    })

    return await reservationRepository.create(reservation)
  }
}
