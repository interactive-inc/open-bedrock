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

/**
 * レンタル予約を申請する。記録のみで重複判定は行わない。
 */
export class CreateRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RentalReservation | Error> {
    const reservationRepository = new RentalReservationRepository(this.c)

    const reservation = RentalReservation.create({
      requesterId: command.requesterId,
      itemName: command.itemName,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      createdAt: command.createdAt,
    })

    return await reservationRepository.create(reservation)
  }
}
