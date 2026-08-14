import { ThanksReward } from "@/contexts/company/domain/thanks-points/thanks-reward.entity"
import { NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/contexts/company/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  rewardId: number
  name: string
  pointCost: number
  isActive: boolean
}

/**
 * 交換カタログのメタ情報を更新する（管理者向け）。名前・コスト・有効状態を差し替える。
 * stock は decrementStock() で原子的に管理するため、ここでは触らない。
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

    // 名前・コストの不変条件は create と同一なので create で検証し、stock は既存値を引き継ぐ。
    const validated = ThanksReward.create({
      name: command.name,
      pointCost: command.pointCost,
      stock: existing.stock,
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
      stock: existing.stock,
      createdAt: existing.createdAt,
    })

    // stock は decrementStock() で原子的に管理するため、管理画面からは上書きしない。
    // 並行する交換申請の承認と競合しても消費済み在庫が復活しない。
    const updated = await rewardRepository.updateWithoutStock(next)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update reward", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("reward not found", "reward_not_found")
    }

    return updated
  }
}
