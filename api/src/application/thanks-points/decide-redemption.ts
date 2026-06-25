import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  redemptionId: number
  deciderId: number
  action: "approve" | "reject"
  decidedAt: string
}

// 確定はできたが在庫減算だけ失敗した結果。交換は確定済みなので巻き戻さず、
// 追跡できるよう redemption と原因を呼び出し側へ表面化する（握りつぶさない）。
// これはエラーではなく「在庫警告つきの成功」なので ApplicationError には含めない。
export type FulfilledWithStockError = {
  reason: "fulfilled_with_stock_error"
  redemption: ThanksRedemption
  stockError: Error
}

export type DecideResult = ThanksRedemption | FulfilledWithStockError | ApplicationError

/**
 * 交換申請を承認（確定）または却下する。
 * 承認は残高チェックを確定 UPDATE の WHERE に畳み込んだ 1 ステートメントで行い、
 * 二重承認・別申請の合計超過のいずれでも残高がマイナスに割れないようにする（TOCTOU 対策）。
 */
export class DecideRedemption {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<DecideResult> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const existing = await redemptionRepository.findById(command.redemptionId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("redemption not found", "redemption_not_found")
    }

    // 承認・却下のどちらも「決裁」行為。利益相反を避けるため、
    // 申請者本人による自己決裁は action を問わずここで弾く。
    if (existing.employeeId === command.deciderId) {
      return new ForbiddenError("cannot decide own redemption", "self_approval_forbidden")
    }

    if (command.action === "reject") {
      return this.reject(command)
    }

    return this.approve(command)
  }

  // 却下。pending からの条件付き UPDATE で確定済みは弾く。0 行更新は already_decided。
  private async reject(command: Command): Promise<ThanksRedemption | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

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

  // 承認＝確定。残高チェックを畳み込んだ条件付き UPDATE で確定し、確定後に在庫を原子的に減らす。
  // 0 行更新は「残高不足 or 既に決裁済み」。findById で pending を確認してから区別する。
  private async approve(
    command: Command,
  ): Promise<ThanksRedemption | FulfilledWithStockError | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const before = await redemptionRepository.findById(command.redemptionId)

    if (before instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: before })
    }

    if (before === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    if (before.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    if (before.employeeId === command.deciderId) {
      return new ForbiddenError("cannot decide own redemption", "self_approval_forbidden")
    }

    const updated = await redemptionRepository.approveFromPending({
      redemptionId: command.redemptionId,
      employeeId: before.employeeId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to approve redemption", { cause: updated })
    }

    if (updated === null) {
      return await this.classifyZeroUpdate(command.redemptionId)
    }

    const stock = await new ThanksRewardRepository(this.c).decrementStock(updated.rewardId)

    if (stock instanceof Error) {
      return { reason: "fulfilled_with_stock_error", redemption: updated, stockError: stock }
    }

    return updated
  }

  // 承認 UPDATE が 0 行のとき、pending のまま残っていれば残高不足、消えていれば既に決裁済みと判定する。
  private async classifyZeroUpdate(redemptionId: number): Promise<ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const after = await redemptionRepository.findById(redemptionId)

    if (after instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: after })
    }

    if (after === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    return after.status === "pending"
      ? new ConflictError("insufficient balance", "insufficient_balance")
      : new ConflictError("redemption already decided", "already_decided")
  }
}
