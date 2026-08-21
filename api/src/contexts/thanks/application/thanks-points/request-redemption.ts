import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-redemption.repository"
import { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-reward.repository"

export type Command = {
  employeeId: number
  rewardId: number
  createdAt: string
}

/**
 * 受領残高から交換を申請する。申請時点で在庫と残高を確認し、point_cost を写し取って pending で記録する。
 * 同一社員に対して PENDING 状態の申請が既に存在する場合は重複を防止する。
 */
export class RequestRedemption {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ThanksRedemption | ApplicationError> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const reward = await rewardRepository.findById(command.rewardId)

    if (reward instanceof Error) {
      return new UnexpectedError("failed to find reward", { cause: reward })
    }

    if (reward === null) {
      return new NotFoundError("reward not found", "reward_not_found")
    }

    if (reward.isActive === false) {
      return new ConflictError("reward is inactive", "reward_inactive")
    }

    if (reward.stock !== null && reward.stock <= 0) {
      return new ConflictError("reward is out of stock", "out_of_stock")
    }

    const redemption = ThanksRedemption.create({
      employeeId: command.employeeId,
      rewardId: reward.id ?? command.rewardId,
      pointCost: reward.pointCost,
      createdAt: command.createdAt,
    })

    // 残高チェックと重複 pending チェックを INSERT にアトミックに畳み込む（TOCTOU 対策）。
    const created = await redemptionRepository.createIfSufficientBalance(redemption)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create redemption", { cause: created })
    }

    if ("reason" in created) {
      if (created.reason === "reward_inactive") {
        return new ConflictError("reward is inactive", "reward_inactive")
      }

      if (created.reason === "out_of_stock") {
        return new ConflictError("reward is out of stock", "out_of_stock")
      }

      if (created.reason === "pending_exists") {
        return new ConflictError("pending redemption already exists", "pending_exists")
      }

      return new ConflictError("insufficient balance", "insufficient_balance")
    }

    return created
  }
}
