import { RoomReservation } from "@/domain/room/room-reservation"
import type { Context } from "@/env"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"
import { RoomRepository } from "@/infrastructure/room/room-repository"

export type Command = {
  roomId: number
  reserverId: number
  startAt: string
  endAt: string
  purpose: string | null
}

export type RoomNotFound = { reason: "room_not_found" }

export type RoomAlreadyReserved = { reason: "room_already_reserved" }

export type InvalidTimeRange = { reason: "invalid_time_range" }

export type StartInPast = { reason: "start_in_past" }

/**
 * 会議室を予約する。会議室が存在しない場合、重複時は判別可能な失敗を返す。
 */
export class CreateRoomReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    RoomReservation | RoomNotFound | RoomAlreadyReserved | InvalidTimeRange | StartInPast | Error
  > {
    if (command.startAt >= command.endAt) {
      return { reason: "invalid_time_range" }
    }

    const now = this.c.env.NOW ?? new Date().toISOString()
    if (command.startAt < now) {
      return { reason: "start_in_past" }
    }

    const roomRepository = new RoomRepository(this.c)

    const room = await roomRepository.findById(command.roomId)

    if (room instanceof Error) {
      return room
    }

    if (room === null) {
      return { reason: "room_not_found" }
    }

    const reservationRepository = new RoomReservationRepository(this.c)

    const reservation = RoomReservation.create({
      roomId: command.roomId,
      reserverId: command.reserverId,
      startAt: command.startAt,
      endAt: command.endAt,
      purpose: command.purpose,
    })

    if ("reason" in reservation) {
      return reservation
    }

    const created = await reservationRepository.createIfNoOverlap(reservation)

    if (created instanceof Error) {
      return created
    }

    if (created === null) {
      return { reason: "room_already_reserved" }
    }

    return created
  }
}
