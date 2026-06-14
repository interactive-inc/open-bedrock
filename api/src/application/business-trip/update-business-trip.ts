import type { BusinessTrip } from "@/domain/business-trip/business-trip.entity"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Command = {
  businessTripId: string
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
}

export type BusinessTripNotFound = { reason: "business_trip_not_found" }

export type NotTraveler = { reason: "not_traveler" }

export type NotModifiable = { reason: "not_modifiable" }

export type OverlappingTrip = { reason: "overlapping_trip" }

export type InvalidDateRange = { reason: "invalid_date_range" }

/**
 * 出張申請の行き先・期間・目的・概算費用を変更する。本人以外と、承認済み申請の変更を拒否する。
 * 変更後の期間が他の出張申請と重複する場合も拒否する。
 */
export class UpdateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | BusinessTrip
    | BusinessTripNotFound
    | NotTraveler
    | NotModifiable
    | OverlappingTrip
    | InvalidDateRange
    | Error
  > {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const current = await businessTripRepository.findById(command.businessTripId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "business_trip_not_found" }
    }

    if (current.travelerId !== command.travelerId) {
      return { reason: "not_traveler" }
    }

    if (!current.isModifiable) {
      return { reason: "not_modifiable" }
    }

    const overlapping = await businessTripRepository.findOverlapping({
      travelerId: command.travelerId,
      startDate: command.startDate,
      endDate: command.endDate,
      excludeBusinessTripId: command.businessTripId,
    })

    if (overlapping instanceof Error) {
      return overlapping
    }

    if (overlapping.length > 0) {
      return { reason: "overlapping_trip" }
    }

    const updated = current.withDetails({
      destination: command.destination,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      estimatedCost: command.estimatedCost,
    })

    if ("reason" in updated) {
      return updated
    }

    const result = await businessTripRepository.update(updated)

    if (result instanceof Error) {
      return result
    }

    if (result === null) {
      return { reason: "not_modifiable" }
    }

    return result
  }
}
