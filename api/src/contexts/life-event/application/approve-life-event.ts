import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/repositories/life-event.repository"
import { isLifeEventRecordSourceFrozenError } from "@/contexts/life-event/infrastructure/repositories/lib/is-life-event-record-source-frozen-error"
import { LifeEventDecisionAuthorityAdapter } from "@/contexts/life-event/infrastructure/adapters/life-event-decision-authority.adapter"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"

export type Command = {
  session: CompanySessionValue
  lifeEventId: string
}

/** ライフイベント届出を、技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が承認する。 */
export class ApproveLifeEvent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<LifeEvent | ApplicationError> {
    if (command.session.hasPermission("life_event:manage") === false) {
      return new ForbiddenError("cannot manage life events", "forbidden")
    }

    const lifeEventRepository = new LifeEventRepository(this.c)

    const current = await lifeEventRepository.findById(command.lifeEventId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find life event", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("life event not found", "life_event_not_found")
    }

    const next = current.withApproved()

    if (next instanceof LifeEvent === false) {
      return new ConflictError("life event is not in a transitionable state", next.reason)
    }

    const authority = await new LifeEventDecisionAuthorityAdapter(this.c).prepare({
      session: command.session,
      subjectEmployeeId: current.employeeId,
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    const updated = await lifeEventRepository.updateStatus({
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
      if (isLifeEventRecordSourceFrozenError(updated))
        return new ConflictError("life event writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to update life event status", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("life event is not in a transitionable state", "invalid_transition")
    }

    return updated
  }
}
