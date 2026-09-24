import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import type { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/repositories/business-trip.repository"
import { isBusinessTripRecordSourceFrozenError } from "@/contexts/business-trip/infrastructure/repositories/lib/is-business-trip-record-source-frozen-error"
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
  travelerId: EmployeeId
  destination: string
  startDate: string
  endDate: string
  purpose: string
  estimatedCost: number | null
}

type Context = Readonly<{
  businessTripRepository: Pick<BusinessTripRepository, "findById" | "findOverlapping" | "update">
}>

/**
 * 出張申請の行き先・期間・目的・概算費用を変更する。本人以外と、承認済み申請の変更を拒否する。
 * 変更後の期間が他の出張申請と重複する場合も拒否する。
 */
export class UpdateBusinessTrip {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<BusinessTrip | ApplicationError> {
    const current = await this.c.businessTripRepository.findById(command.businessTripId)

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

    const overlapping = await this.c.businessTripRepository.findOverlapping({
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

    const result = await this.c.businessTripRepository.update(updated)

    if (result instanceof Error) {
      if (isBusinessTripRecordSourceFrozenError(result)) {
        return new ConflictError("business trip writes are frozen", "record_source_frozen", {
          cause: result,
        })
      }
      return new UnexpectedError("failed to update business trip", { cause: result })
    }

    if (result === null) {
      return new ConflictError("business trip is not modifiable", "not_modifiable")
    }

    return result
  }
}
