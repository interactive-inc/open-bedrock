import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  redemptionId: number
  deciderId: number
  action: "approve" | "reject"
  decidedAt: string
}

export type RedemptionNotFound = { reason: "redemption_not_found" }

export type AlreadyDecided = { reason: "already_decided" }

export type InsufficientBalance = { reason: "insufficient_balance" }

export type OutOfStock = { reason: "out_of_stock" }

export type SelfApprovalForbidden = { reason: "self_approval_forbidden" }

// 確定はできたが在庫減算だけ失敗した結果。交換は確定済みなので巻き戻さず、
// 追跡できるよう redemption と原因を呼び出し側へ表面化する（握りつぶさない）。
export type FulfilledWithStockError = {
  reason: "fulfilled_with_stock_error"
  redemption: ThanksRedemption
  stockError: Error
}

export type DecideResult =
  | ThanksRedemption
  | RedemptionNotFound
  | AlreadyDecided
  | InsufficientBalance
  | OutOfStock
  | SelfApprovalForbidden
  | FulfilledWithStockError
  | Error

// 交換申請を承認（確定）または却下する。
// 承認は残高チェックを確定 UPDATE の WHERE に畳み込んだ 1 ステートメントで行い、
// 二重承認・別申請の合計超過のいずれでも残高がマイナスに割れないようにする（TOCTOU 対策）。
export class DecideRedemption {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<DecideResult> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const existing = await redemptionRepository.findById(command.redemptionId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "redemption_not_found" }
    }

    // 承認・却下のどちらも「決裁」行為。利益相反を避けるため、
    // 申請者本人による自己決裁は action を問わずここで弾く。
    if (existing.employeeId === command.deciderId) {
      return { reason: "self_approval_forbidden" }
    }

    if (command.action === "reject") {
      return this.reject(command)
    }

    return this.approve(command)
  }

  // 却下。pending からの条件付き UPDATE で確定済みは弾く。0 行更新は already_decided。
  private async reject(command: Command): Promise<ThanksRedemption | AlreadyDecided | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const updated = await redemptionRepository.rejectFromPending({
      redemptionId: command.redemptionId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return updated
    }

    return updated === null ? { reason: "already_decided" } : updated
  }

  // 承認＝確定。残高チェックと在庫減算を同一 batch に畳み込んだ条件付き UPDATE で確定する。
  // 0 行更新は「残高不足 or 既に決裁済み」。findById で pending を確認してから区別する。
  private async approve(
    command: Command,
  ): Promise<
    | ThanksRedemption
    | AlreadyDecided
    | InsufficientBalance
    | OutOfStock
    | SelfApprovalForbidden
    | FulfilledWithStockError
    | Error
  > {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const before = await redemptionRepository.findById(command.redemptionId)

    if (before instanceof Error) {
      return before
    }

    if (before === null) {
      return { reason: "already_decided" }
    }

    if (before.status !== "pending") {
      return { reason: "already_decided" }
    }

    if (before.employeeId === command.deciderId) {
      return { reason: "self_approval_forbidden" }
    }

    const updated = await redemptionRepository.approveFromPending({
      redemptionId: command.redemptionId,
      employeeId: before.employeeId,
      rewardId: before.rewardId,
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return await this.classifyZeroUpdate(command.redemptionId)
    }

    return updated
  }

  // 承認 UPDATE が 0 行のとき、pending のまま残っていれば残高不足、消えていれば既に決裁済みと判定する。
  private async classifyZeroUpdate(
    redemptionId: number,
  ): Promise<AlreadyDecided | InsufficientBalance | OutOfStock | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const after = await redemptionRepository.findById(redemptionId)

    if (after instanceof Error) {
      return after
    }

    if (after === null) {
      return { reason: "already_decided" }
    }

    if (after.status !== "pending") {
      return { reason: "already_decided" }
    }

    const reward = await new ThanksRewardRepository(this.c).findById(after.rewardId)

    if (reward instanceof Error) {
      return reward
    }

    if (reward !== null && reward.stock !== null && reward.stock <= 0) {
      return { reason: "out_of_stock" }
    }

    return { reason: "insufficient_balance" }
  }
}
