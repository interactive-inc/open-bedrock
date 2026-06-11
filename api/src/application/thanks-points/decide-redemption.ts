import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
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

  // 承認＝確定。残高チェックを畳み込んだ条件付き UPDATE で確定し、確定後に在庫を原子的に減らす。
  // 0 行更新は「残高不足 or 既に決裁済み」。findById で pending を確認してから区別する。
  private async approve(
    command: Command,
  ): Promise<
    | ThanksRedemption
    | AlreadyDecided
    | InsufficientBalance
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
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (updated instanceof Error) {
      return updated
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
  private async classifyZeroUpdate(
    redemptionId: number,
  ): Promise<AlreadyDecided | InsufficientBalance | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const after = await redemptionRepository.findById(redemptionId)

    if (after instanceof Error) {
      return after
    }

    if (after === null) {
      return { reason: "already_decided" }
    }

    return after.status === "pending"
      ? { reason: "insufficient_balance" }
      : { reason: "already_decided" }
  }
}
