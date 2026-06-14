import { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

export type Command = {
  name: string
  pointCost: number
  stock: number | null
  createdAt: string
}

export type InvalidReward = { reason: "invalid_reward" }

// 交換カタログを1件登録する（管理者向け）。
export class CreateReward {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ThanksReward | InvalidReward | Error> {
    const reward = ThanksReward.create({
      name: command.name,
      pointCost: command.pointCost,
      stock: command.stock,
      createdAt: command.createdAt,
    })

    if (reward instanceof Error) {
      return { reason: "invalid_reward" }
    }

    const rewardRepository = new ThanksRewardRepository(this.c)

    return rewardRepository.create(reward)
  }
}
