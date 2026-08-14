import type { BusinessTrip } from "@/contexts/company/domain/business-trip/business-trip.entity"
import type { Context } from "@/env"
import { BusinessTripRepository } from "@/contexts/company/infrastructure/business-trip/business-trip-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  businessTripId: string
  travelerId: number
}

/**
 * 出張申請を1件取得する。本人以外の閲覧を拒否する。
 */
export class GetBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | ApplicationError> {
    const businessTripRepository = new BusinessTripRepository(this.c)

    const businessTrip = await businessTripRepository.findById(command.businessTripId)

    if (businessTrip instanceof Error) {
      return new UnexpectedError("failed to find business trip", { cause: businessTrip })
    }

    if (businessTrip === null) {
      return new NotFoundError("business trip not found", "business_trip_not_found")
    }

    if (businessTrip.travelerId !== command.travelerId) {
      return new ForbiddenError("not the traveler", "not_traveler")
    }

    return businessTrip
  }
}
