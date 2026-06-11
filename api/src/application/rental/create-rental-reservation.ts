import { RentalReservation } from "@/domain/rental/rental-reservation"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/infrastructure/rental/rental-reservation-repository"

export type Command = {
  requesterId: number
  itemName: string
  startDate: string
  endDate: string
  purpose: string | null
  createdAt: string
}

export type InvalidDateRange = { reason: "invalid_date_range" }

export type OverlappingReservation = { reason: "overlapping_reservation" }

/**
 * レンタル予約を申請する。同一品名・期間の重複予約を拒否する。
 */
export class CreateRentalReservation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<RentalReservation | InvalidDateRange | OverlappingReservation | Error> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const reservation = RentalReservation.create({
      requesterId: command.requesterId,
      itemName: command.itemName,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      createdAt: command.createdAt,
    })

    if ("reason" in reservation) {
      return reservation
    }

    // 同一品名・重複期間の requested 予約があれば拒否する。
    const overlapping = await reservationRepository.findOverlapping({
      itemName: command.itemName,
      startDate: command.startDate,
      endDate: command.endDate,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "overlapping_reservation" }
    }

    const created = await reservationRepository.create(reservation)

    // 条件付き INSERT が 0 行だった場合は並行リクエストによる重複
    if (created === null) {
      return { reason: "overlapping_reservation" }
    }

    return created
  }
}
