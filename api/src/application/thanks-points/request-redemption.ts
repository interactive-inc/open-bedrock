import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  employeeId: number
  rewardId: number
  createdAt: string
}

export type RewardNotFound = { reason: "reward_not_found" }

export type RewardInactive = { reason: "reward_inactive" }

export type OutOfStock = { reason: "out_of_stock" }

export type InsufficientBalance = { reason: "insufficient_balance" }

export type PendingExists = { reason: "pending_exists" }

// 受領残高から交換を申請する。申請時点で在庫と残高を確認し、point_cost を写し取って pending で記録する。
// 同一社員に対して PENDING 状態の申請が既に存在する場合は重複を防止する。
export class RequestRedemption {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | ThanksRedemption
    | RewardNotFound
    | RewardInactive
    | OutOfStock
    | InsufficientBalance
    | PendingExists
    | Error
  > {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const reward = await rewardRepository.findById(command.rewardId)

    if (reward instanceof Error) {
      return reward
    }

    if (reward === null) {
      return { reason: "reward_not_found" }
    }

    if (reward.isActive === false) {
      return { reason: "reward_inactive" }
    }

    if (reward.stock !== null && reward.stock <= 0) {
      return { reason: "out_of_stock" }
    }

    const redemption = ThanksRedemption.create({
      employeeId: command.employeeId,
      rewardId: reward.id ?? command.rewardId,
      pointCost: reward.pointCost,
      createdAt: command.createdAt,
    })

    // 残高チェックと重複 pending チェックを INSERT にアトミックに畳み込む（TOCTOU 対策）。
    const created = await redemptionRepository.createIfSufficientBalance(redemption)

    return created
  }
}
