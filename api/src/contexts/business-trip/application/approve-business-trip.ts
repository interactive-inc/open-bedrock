import type { Session } from "@/lib/auth/session"
import { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/repositories/business-trip.repository"

export type Command = {
  session: Session
  businessTripId: string
}

/** 出張申請を承認する。 */
export class ApproveBusinessTrip {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<BusinessTrip | ApplicationError> {
    if (command.session.hasPermission("business_trip:manage") === false) {
      return new ForbiddenError("cannot manage business trips", "forbidden")
    }

    const businessTripRepository = new BusinessTripRepository(this.c)

    const current = await businessTripRepository.findById(command.businessTripId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find business trip", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("business trip not found", "business_trip_not_found")
    }

    const next = current.withApproved()

    if (next instanceof BusinessTrip === false) {
      return new ConflictError("business trip is not in a transitionable state", next.reason)
    }

    const updated = await businessTripRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update business trip status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError(
        "business trip is not in a transitionable state",
        "invalid_transition",
      )
    }

    return updated
  }
}
