import { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  rewardId: number
  name: string
  pointCost: number
  stock: number | null
  isActive: boolean
}

export type RewardNotFound = { reason: "reward_not_found" }

export type InvalidReward = { reason: "invalid_reward" }

// 交換カタログを更新する（管理者向け）。名前・コスト・在庫・有効状態を差し替える。
export class UpdateReward {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ThanksReward | RewardNotFound | InvalidReward | Error> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const existing = await rewardRepository.findById(command.rewardId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "reward_not_found" }
    }

    if (existing.id === null) {
      return new Error("persisted reward must have an id")
    }

    // 名前・コスト・在庫の不変条件は create と同一なので create で検証し、id と作成日時は既存値を引き継ぐ。
    const validated = ThanksReward.create({
      name: command.name,
      pointCost: command.pointCost,
      stock: command.stock,
      createdAt: existing.createdAt,
    })

    if (validated instanceof Error) {
      return { reason: "invalid_reward" }
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
      return updated
    }

    if (updated === null) {
      return { reason: "reward_not_found" }
    }

    return updated
  }
}
