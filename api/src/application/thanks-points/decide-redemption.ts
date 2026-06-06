import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
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

// 交換申請を承認（確定）または却下する。
// 承認時は残高を再確認し（TOCTOU 対策）、pending からの条件付き UPDATE で二重承認＝二重消費を原子的に弾く。
export class DecideRedemption {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<ThanksRedemption | RedemptionNotFound | AlreadyDecided | InsufficientBalance | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const existing = await redemptionRepository.findById(command.redemptionId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "redemption_not_found" }
    }

    if (existing.status !== "pending") {
      return { reason: "already_decided" }
    }

    if (command.action === "reject") {
      return this.reject(existing, command)
    }

    return this.approve(existing, command)
  }

  // 却下。pending からの条件付き UPDATE で確定済みは弾く。
  private async reject(
    redemption: ThanksRedemption,
    command: Command,
  ): Promise<ThanksRedemption | AlreadyDecided | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const rejected = redemption.withRejected({
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (rejected instanceof Error) {
      return rejected
    }

    const updated = await redemptionRepository.decideFromPending(rejected)

    if (updated instanceof Error) {
      return updated
    }

    return updated === null ? { reason: "already_decided" } : updated
  }

  // 承認＝確定。残高を再確認してから pending を奪う。確定後に在庫を1つ減らす。
  private async approve(
    redemption: ThanksRedemption,
    command: Command,
  ): Promise<ThanksRedemption | AlreadyDecided | InsufficientBalance | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const balance = await redemptionRepository.getBalance(redemption.employeeId)

    if (balance instanceof Error) {
      return balance
    }

    if (balance < redemption.pointCost) {
      return { reason: "insufficient_balance" }
    }

    const approved = redemption.withApproved({
      deciderId: command.deciderId,
      decidedAt: command.decidedAt,
    })

    if (approved instanceof Error) {
      return approved
    }

    const updated = await redemptionRepository.decideFromPending(approved)

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "already_decided" }
    }

    await this.decrementStock(updated.rewardId)

    return updated
  }

  // 在庫を1つ減らす。無制限カタログや在庫切れは無視（残高側で消費は確定済み）。
  // 在庫はベストエフォートで、失敗してもログのみ残す（確定済みの交換を巻き戻さない）。
  private async decrementStock(rewardId: number): Promise<void> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const reward = await rewardRepository.findById(rewardId)

    if (reward instanceof Error || reward === null) {
      console.error("failed to load reward for stock decrement", rewardId)

      return
    }

    const decremented = reward.withStockDecremented()

    if (decremented instanceof Error) {
      return
    }

    const updated = await rewardRepository.update(decremented)

    if (updated instanceof Error) {
      console.error("failed to decrement reward stock", updated)
    }
  }
}
