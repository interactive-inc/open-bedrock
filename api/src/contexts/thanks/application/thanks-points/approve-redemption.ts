import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import type { FulfilledWithStockError } from "@/contexts/thanks/application/thanks-points/errors"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import type { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-reward.repository"
import { isCompanyWriteAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"
import type {
  ThanksRedemptionDecisionAuthority,
  ThanksRedemptionDecisionAuthorityAdapter,
} from "@/contexts/thanks/infrastructure/adapters/thanks-redemption-decision-authority.adapter"
import { isThanksRecordSourceFrozenError } from "@/contexts/thanks/infrastructure/repositories/lib/is-thanks-record-source-frozen-error"

type Context = Readonly<{
  redemptionRepository: Pick<ThanksRedemptionRepository, "findById" | "approveFromPending">
  rewardRepository: Pick<ThanksRewardRepository, "findById">
  decisionAuthority: Pick<ThanksRedemptionDecisionAuthorityAdapter, "prepare">
}>

export type Command = {
  session: CompanySessionValue
  redemptionId: number
  deciderId: EmployeeId
  decidedAt: string
}

export type OutOfStock = { reason: "out_of_stock" }

export type ApproveResult =
  | ThanksRedemption
  | OutOfStock
  | FulfilledWithStockError
  | ApplicationError

/** 技術的権限と申請者に対するCompany上の管理範囲の両方を満たす判断者が、交換申請を承認する。 */
export class ApproveRedemption {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<ApproveResult> {
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

    // 利益相反を避けるため、申請者本人による自己承認を拒否する。
    if (existing.employeeId === command.deciderId) {
      return new ForbiddenError("cannot decide own redemption", "self_approval_forbidden")
    }
    if (existing.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    const authority = await this.c.decisionAuthority.prepare({
      session: command.session,
      subjectEmployeeIds: [existing.employeeId],
    })

    if (authority instanceof Error) {
      return new ForbiddenError(authority.message, authority.code, { cause: authority })
    }

    return this.approve(existing, command, authority.guards)
  }

  /**
   * 承認＝確定。残高チェックと在庫減算を同一 batch に畳み込んだ条件付き UPDATE で確定する。
   * 0 行更新は「残高不足 or 在庫切れ or 既に決裁済み」。findById で pending を確認してから区別する。
   */
  private async approve(
    existing: ThanksRedemption,
    command: Command,
    guards: ThanksRedemptionDecisionAuthority["guards"],
  ): Promise<ThanksRedemption | OutOfStock | FulfilledWithStockError | ApplicationError> {
    if (existing.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    const updated = await this.c.redemptionRepository.approveFromPending({
      redemptionId: command.redemptionId,
      employeeId: existing.employeeId,
      rewardId: existing.rewardId,
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
      return new UnexpectedError("failed to approve redemption", { cause: updated })
    }

    if (updated === null) {
      return await this.classifyZeroUpdate(command.redemptionId)
    }

    return updated
  }

  /**
   * 承認 UPDATE が 0 行のとき、在庫切れか残高不足か既に決裁済みかを判定する。
   * pending のまま残っていれば在庫 or 残高、消えていれば既に決裁済み。
   */
  private async classifyZeroUpdate(redemptionId: number): Promise<OutOfStock | ApplicationError> {
    const after = await this.c.redemptionRepository.findById(redemptionId)

    if (after instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: after })
    }

    if (after === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    if (after.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    const reward = await this.c.rewardRepository.findById(after.rewardId)

    if (reward instanceof Error) {
      return new UnexpectedError("failed to find reward", { cause: reward })
    }

    if (reward !== null && reward.stock !== null && reward.stock <= 0) {
      return { reason: "out_of_stock" }
    }

    return new ConflictError("insufficient balance", "insufficient_balance")
  }
}
