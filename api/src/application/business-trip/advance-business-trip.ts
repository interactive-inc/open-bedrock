import { canManageBusinessTrips } from "@/lib/business-trip/can-manage-business-trips"
import { BusinessTrip } from "@/domain/business-trip/business-trip.entity"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { BusinessTripRepository } from "@/infrastructure/business-trip/business-trip-repository"

export type Action = "approve" | "reject"

export type Command = {
  session: SessionPayload
  businessTripId: string
  action: Action
}

/**
 * 人事が出張申請の状態を代理で進める。requested のみ approved/rejected へ遷移でき、
 * それ以外の現在状態からの遷移は 409 とする。
 */
export class AdvanceBusinessTrip {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BusinessTrip | ApplicationError> {
    if (canManageBusinessTrips(command.session) === false) {
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

    const next = command.action === "approve" ? current.withApproved() : current.withRejected()

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
