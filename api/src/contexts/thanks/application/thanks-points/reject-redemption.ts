import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"
import type {
  ThanksRedemptionDecisionAuthority,
  ThanksRedemptionDecisionAuthorityAdapter,
} from "@/contexts/thanks/infrastructure/adapters/thanks-redemption-decision-authority.adapter"
import { isThanksRecordSourceFrozenError } from "@/contexts/thanks/infrastructure/repositories/lib/is-thanks-record-source-frozen-error"

type Context = Readonly<{
  redemptionRepository: Pick<ThanksRedemptionRepository, "findById" | "rejectFromPending">
  decisionAuthority: Pick<ThanksRedemptionDecisionAuthorityAdapter, "prepare">
}>

export type Command = {
  session: CompanySessionValue
  redemptionId: number
  deciderId: EmployeeId
  decidedAt: string
}

/** 技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が、交換申請を却下する。 */
export class RejectRedemption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<ThanksRedemption | ApplicationError> {
    if (command.session.hasPermission("thanks_redemption:approve") === false) {
      return new ForbiddenError("cannot decide redemption", "forbidden")
    }

    const existing = await this.c.redemptionRepository.findById(command.redemptionId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("redemption not found", "redemption_not_found")
    }

    // 利益相反を避けるため、申請者本人による自己却下を拒否する。
    if (existing.employeeId === command.deciderId) {
      return new ForbiddenError("cannot decide own redemption", "self_approval_forbidden")
    }

    const authority = await this.c.decisionAuthority.prepare({
      session: command.session,
      subjectEmployeeIds: [existing.employeeId],
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    return this.reject(command, authority.guards)
  }

  /** 却下。pending からの条件付き UPDATE で確定済みは弾く。0 行更新は already_decided。 */
  private async reject(
    command: Command,
    guards: ThanksRedemptionDecisionAuthority["guards"],
  ): Promise<ThanksRedemption | ApplicationError> {
    const updated = await this.c.redemptionRepository.rejectFromPending({
      redemptionId: command.redemptionId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
      guards,
    })

    if (updated instanceof Error) {
      if (isCompanyWriteAbortedByGuard(updated))
        return new ConflictError(
          "company authority changed before saving",
          "company_authority_changed",
          { cause: updated },
        )
      if (isThanksRecordSourceFrozenError(updated))
        return new ConflictError("thanks writes are frozen", "record_source_frozen", {
          cause: updated,
        })
      return new UnexpectedError("failed to reject redemption", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    return updated
  }
}
