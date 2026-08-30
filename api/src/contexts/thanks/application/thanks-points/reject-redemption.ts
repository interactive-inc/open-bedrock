import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"

export type Command = {
  session: CompanySessionValue
  redemptionId: number
  deciderId: EmployeeId
  decidedAt: string
}

/** 交換申請を却下する。 */
export class RejectRedemption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<ThanksRedemption | ApplicationError> {
    if (command.session.hasPermission("thanks_redemption:approve") === false) {
      return new ForbiddenError("cannot decide redemption", "forbidden")
    }

    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const existing = await redemptionRepository.findById(command.redemptionId)

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

    return this.reject(redemptionRepository, command)
  }

  /** 却下。pending からの条件付き UPDATE で確定済みは弾く。0 行更新は already_decided。 */
  private async reject(
    redemptionRepository: ThanksRedemptionRepository,
    command: Command,
  ): Promise<ThanksRedemption | ApplicationError> {
    const updated = await redemptionRepository.rejectFromPending({
      redemptionId: command.redemptionId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to reject redemption", { cause: updated })
    }

    if (updated === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    return updated
  }
}
