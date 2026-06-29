import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"
import { canDecideRedemption } from "@/lib/thanks-points/can-decide-redemption"

export type Command = {
  session: SessionPayload
  redemptionId: number
  deciderId: number
  action: "approve" | "reject"
  decidedAt: string
}

export type OutOfStock = { reason: "out_of_stock" }

// 確定はできたが在庫減算だけ失敗した結果。交換は確定済みなので巻き戻さず、
// 追跡できるよう redemption と原因を呼び出し側へ表面化する（握りつぶさない）。
// これはエラーではなく「在庫警告つきの成功」なので ApplicationError には含めない。
export type FulfilledWithStockError = {
  reason: "fulfilled_with_stock_error"
  redemption: ThanksRedemption
  stockError: Error
}

export type DecideResult =
  | ThanksRedemption
  | OutOfStock
  | FulfilledWithStockError
  | ApplicationError

/**
 * 交換申請を承認（確定）または却下する。
 * 承認は残高チェックを確定 UPDATE の WHERE に畳み込んだ 1 ステートメントで行い、
 * 二重承認・別申請の合計超過のいずれでも残高がマイナスに割れないようにする（TOCTOU 対策）。
 */
export class DecideRedemption {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<DecideResult> {
    if (canDecideRedemption(command.session) === false) {
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

    // 承認・却下のどちらも「決裁」行為。利益相反を避けるため、
    // 申請者本人による自己決裁は action を問わずここで弾く。
    if (existing.employeeId === command.deciderId) {
      return new ForbiddenError("cannot decide own redemption", "self_approval_forbidden")
    }

    if (command.action === "reject") {
      return this.reject(redemptionRepository, command)
    }

    return this.approve(redemptionRepository, existing, command)
  }

  // 却下。pending からの条件付き UPDATE で確定済みは弾く。0 行更新は already_decided。
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

  // 承認＝確定。残高チェックと在庫減算を同一 batch に畳み込んだ条件付き UPDATE で確定する。
  // 0 行更新は「残高不足 or 在庫切れ or 既に決裁済み」。findById で pending を確認してから区別する。
  private async approve(
    redemptionRepository: ThanksRedemptionRepository,
    existing: ThanksRedemption,
    command: Command,
  ): Promise<ThanksRedemption | OutOfStock | FulfilledWithStockError | ApplicationError> {
    if (existing.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    const updated = await redemptionRepository.approveFromPending({
      redemptionId: command.redemptionId,
      employeeId: existing.employeeId,
      rewardId: existing.rewardId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return new UnexpectedError("failed to approve redemption", { cause: updated })
    }

    if (updated === null) {
      return await this.classifyZeroUpdate(command.redemptionId)
    }

    return updated
  }

  // 承認 UPDATE が 0 行のとき、在庫切れか残高不足か既に決裁済みかを判定する。
  // pending のまま残っていれば在庫 or 残高、消えていれば既に決裁済み。
  private async classifyZeroUpdate(redemptionId: number): Promise<OutOfStock | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const after = await redemptionRepository.findById(redemptionId)

    if (after instanceof Error) {
      return new UnexpectedError("failed to find redemption", { cause: after })
    }

    if (after === null) {
      return new ConflictError("redemption already decided", "already_decided")
    }

    if (after.status !== "pending") {
      return new ConflictError("redemption already decided", "already_decided")
    }

    const reward = await new ThanksRewardRepository(this.c).findById(after.rewardId)

    if (reward instanceof Error) {
      return new UnexpectedError("failed to find reward", { cause: reward })
    }

    if (reward !== null && reward.stock !== null && reward.stock <= 0) {
      return { reason: "out_of_stock" }
    }

    return new ConflictError("insufficient balance", "insufficient_balance")
  }
}
