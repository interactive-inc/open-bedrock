import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ResignationRepository } from "@/contexts/resignation/infrastructure/repositories/resignation.repository"
import { isResignationRecordSourceFrozenError } from "@/contexts/resignation/infrastructure/repositories/lib/is-resignation-record-source-frozen-error"
import { ResignationDecisionAuthorityAdapter } from "@/contexts/resignation/infrastructure/adapters/resignation-decision-authority.adapter"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"

export type Command = {
  session: CompanySessionValue
  resignationId: string
}

/** 退職申請を、技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が却下する。 */
export class RejectResignation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<Resignation | ApplicationError> {
    if (command.session.hasPermission("resignation:manage") === false) {
      return new ForbiddenError("cannot manage resignations", "forbidden")
    }

    const resignationRepository = new ResignationRepository(this.c)

    const current = await resignationRepository.findById(command.resignationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find resignation", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("resignation not found", "resignation_not_found")
    }

    const next = current.withRejected()

    if (next instanceof Resignation === false) {
      return new ConflictError("resignation is not in a transitionable state", next.reason)
    }

    const authority = await new ResignationDecisionAuthorityAdapter(this.c).prepare({
      session: command.session,
      subjectEmployeeId: current.employeeId,
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const updated = await resignationRepository.updateStatus({
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
      if (isResignationRecordSourceFrozenError(updated))
        return new ConflictError("resignation writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to update resignation status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("resignation is not in a transitionable state", "invalid_transition")
    }

    return updated
  }
}
