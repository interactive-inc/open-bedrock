import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { FamilyCareLeave } from "@/contexts/family-care-leave/domain/entities/family-care-leave.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { FamilyCareLeaveRepository } from "@/contexts/family-care-leave/infrastructure/repositories/family-care-leave.repository"
import { isFamilyCareLeaveRecordSourceFrozenError } from "@/contexts/family-care-leave/infrastructure/repositories/lib/is-family-care-leave-record-source-frozen-error"
import { FamilyCareLeaveDecisionAuthorityAdapter } from "@/contexts/family-care-leave/infrastructure/adapters/family-care-leave-decision-authority.adapter"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"

export type Command = {
  session: CompanySessionValue
  familyCareLeaveId: string
}

/** 産休・育休・介護休業の申出を、技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が承認する。 */
export class ApproveFamilyCareLeave {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<FamilyCareLeave | ApplicationError> {
    if (command.session.hasPermission("family_care_leave:manage") === false) {
      return new ForbiddenError("cannot manage family care leaves", "forbidden")
    }

    const familyCareLeaveRepository = new FamilyCareLeaveRepository(this.c)

    const current = await familyCareLeaveRepository.findById(command.familyCareLeaveId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find family care leave", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("family care leave not found", "family_care_leave_not_found")
    }

    const next = current.withApproved()

    if (next instanceof FamilyCareLeave === false) {
      return new ConflictError("family care leave is not in a transitionable state", next.reason)
    }

    const authority = await new FamilyCareLeaveDecisionAuthorityAdapter(this.c).prepare({
      session: command.session,
      subjectEmployeeId: current.employeeId,
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const updated = await familyCareLeaveRepository.decideStatus({
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
      if (isFamilyCareLeaveRecordSourceFrozenError(updated))
        return new ConflictError("family care leave writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to update family care leave status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError(
        "family care leave is not in a transitionable state",
        "invalid_transition",
      )
    }

    return updated
  }
}
