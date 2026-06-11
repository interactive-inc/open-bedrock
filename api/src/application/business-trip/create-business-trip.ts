import { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
  createdAt: string
}

export type OverlappingTrip = { reason: "overlapping_trip" }

export type InvalidDateRange = { reason: "invalid_date_range" }

/**
 * 出張申請を作成する。status は "requested" で登録する。
 * 同一申請者の期間が重複する出張申請が既に存在する場合は拒否する。
 */
export class CreateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | OverlappingTrip | InvalidDateRange | Error> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const overlapping = await businessTripRepository.findOverlapping({
      travelerId: command.travelerId,
      startDate: command.startDate,
      endDate: command.endDate,
      excludeBusinessTripId: null,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "overlapping_trip" }
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
      return businessTrip
    }

    const result = await businessTripRepository.create(businessTrip)

    if (result === null) {
      return { reason: "overlapping_trip" }
    }

    return result
  }
}
