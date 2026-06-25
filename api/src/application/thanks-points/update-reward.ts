import { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import { NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  rewardId: number
  name: string
  pointCost: number
  stock: number | null
  isActive: boolean
}

/**
 * 交換カタログを更新する（管理者向け）。名前・コスト・在庫・有効状態を差し替える。
 */
export class UpdateReward {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ThanksReward | ApplicationError> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const existing = await rewardRepository.findById(command.rewardId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find reward", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("reward not found", "reward_not_found")
    }

    if (existing.id === null) {
      return new UnexpectedError("persisted reward must have an id")
    }

    // 名前・コスト・在庫の不変条件は create と同一なので create で検証し、id と作成日時は既存値を引き継ぐ。
    const validated = ThanksReward.create({
      name: command.name,
      pointCost: command.pointCost,
      stock: command.stock,
      createdAt: existing.createdAt,
    })

    if (validated instanceof Error) {
      return new ValidationError("invalid reward", "invalid_reward")
    }

    const next = ThanksReward.fromRow({
      id: existing.id,
      name: validated.name,
      pointCost: validated.pointCost,
      isActive: command.isActive,
      stock: validated.stock,
      createdAt: existing.createdAt,
    })

    const updated = await rewardRepository.update(next)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update reward", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("reward not found", "reward_not_found")
    }

    return updated
  }
}
