import type { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/business-trip.repository"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  businessTripId: string
  travelerId: number
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
}

/**
 * 出張申請の行き先・期間・目的・概算費用を変更する。本人以外と、承認済み申請の変更を拒否する。
 * 変更後の期間が他の出張申請と重複する場合も拒否する。
 */
export class UpdateBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | ApplicationError> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const current = await businessTripRepository.findById(command.businessTripId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find business trip", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("business trip not found", "business_trip_not_found")
    }

    if (current.travelerId !== command.travelerId) {
      return new ForbiddenError("not the traveler", "not_traveler")
    }

    if (!current.isModifiable) {
      return new ConflictError("business trip is not modifiable", "not_modifiable")
    }

    const overlapping = await businessTripRepository.findOverlapping({
      travelerId: command.travelerId,
      startDate: command.startDate,
      endDate: command.endDate,
      excludeBusinessTripId: command.businessTripId,
    })

    if (overlapping instanceof Error) {
      return new UnexpectedError("failed to find business trips", { cause: overlapping })
    }

    if (overlapping.length > 0) {
      return new ConflictError("overlapping business trip already exists", "overlapping_trip")
    }

    const updated = current.withDetails({
      destination: command.destination,
      startDate: command.startDate,
      endDate: command.endDate,
      purpose: command.purpose,
      estimatedCost: command.estimatedCost,
    })

    if ("reason" in updated) {
      return new ValidationError("invalid date range", "invalid_date_range")
    }

    const result = await businessTripRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update business trip", { cause: result })
    }

    if (result === null) {
      return new ConflictError("business trip is not modifiable", "not_modifiable")
    }

    return result
  }
}
