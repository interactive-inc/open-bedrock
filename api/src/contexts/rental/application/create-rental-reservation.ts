import { RentalReservation } from "@/contexts/rental/domain/entities/rental-reservation.entity"
import { ConflictError, ValidationError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/rental-reservation.repository"

export type Command = {
  requesterId: number
  itemName: string
  startDate: string
  endDate: string
  purpose: string | null
  createdAt: string
}

/**
 * レンタル予約を申請する。同一品名・期間の重複予約を拒否する。
 */
export class CreateRentalReservation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<RentalReservation | ApplicationError> {
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
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    // 同一品名・重複期間の requested 予約があれば、条件付き INSERT が 0 行となり null を返す。
    const created = await reservationRepository.createIfNoOverlap(reservation)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create reservation", { cause: created })
    }

    // 条件付き INSERT が 0 行だった場合は重複（並行リクエスト含む）
    if (created === null) {
      return new ConflictError(
        "an overlapping rental reservation already exists",
        "overlapping_reservation",
      )
    }

    return created
  }
}
