import { BusinessTrip } from "@/contexts/business-trip/domain/business-trip.entity"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/business-trip.repository"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
  createdAt: string
}

/**
 * 出張申請を作成する。status は "requested" で登録する。
 * 同一申請者の期間が重複する出張申請が既に存在する場合は拒否する。
 */
export class CreateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | ApplicationError> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const overlapping = await businessTripRepository.findOverlapping({
      travelerId: command.travelerId,
      startDate: command.startDate,
      endDate: command.endDate,
      excludeBusinessTripId: null,
    })

    if (overlapping instanceof Error) {
      return new UnexpectedError("failed to find business trips", { cause: overlapping })
    }

    if (overlapping.length > 0) {
      return new ConflictError("overlapping business trip already exists", "overlapping_trip")
    }

    const businessTrip = BusinessTrip.create({
      travelerId: command.travelerId,
      destination: command.destination,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      estimatedCost: command.estimatedCost,
      createdAt: command.createdAt,
    })

    if ("reason" in businessTrip) {
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    const result = await businessTripRepository.create(businessTrip)

    if (result instanceof Error) {
      return new UnexpectedError("failed to create business trip", { cause: result })
    }

    if (result === null) {
      return new ConflictError("overlapping business trip already exists", "overlapping_trip")
    }

    return result
  }
}
