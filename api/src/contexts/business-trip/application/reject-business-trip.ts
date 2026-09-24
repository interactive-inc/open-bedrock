import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/repositories/business-trip.repository"
import { isBusinessTripRecordSourceFrozenError } from "@/contexts/business-trip/infrastructure/repositories/lib/is-business-trip-record-source-frozen-error"
import { BusinessTripDecisionAuthorityAdapter } from "@/contexts/business-trip/infrastructure/adapters/business-trip-decision-authority.adapter"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"

export type Command = {
  session: CompanySessionValue
  businessTripId: string
}

/** 出張申請を、技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が却下する。 */
export class RejectBusinessTrip {
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

    const next = current.withRejected()

    if (next instanceof BusinessTrip === false) {
      return new ConflictError("business trip is not in a transitionable state", next.reason)
    }

    const authority = await new BusinessTripDecisionAuthorityAdapter(this.c).prepare({
      session: command.session,
      subjectEmployeeId: current.travelerId,
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const updated = await businessTripRepository.updateStatus({
      id: current.id,
      fromStatus: current.status,
      toStatus: next.status,
      guards: authority.guards,
    })

    if (updated instanceof Error) {
      if (isCompanyWriteAbortedByGuard(updated)) {
        return new ConflictError(
          "company authority changed before saving",
          "company_authority_changed",
          {
            cause: updated,
          },
        )
      }
      if (isBusinessTripRecordSourceFrozenError(updated)) {
        return new ConflictError("business trip writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      }
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
