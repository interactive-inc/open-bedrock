import { ThanksReward } from "@/contexts/thanks/domain/entities/thanks-reward.entity"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import { isThanksRecordSourceFrozenError } from "@/contexts/thanks/infrastructure/repositories/lib/is-thanks-record-source-frozen-error"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-reward.repository"

export type Command = {
  name: string
  pointCost: number
  stock: number | null
  createdAt: string
}

/**
 * 交換カタログを1件登録する（管理者向け）。
 */
export class CreateReward {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<ThanksReward | ApplicationError> {
    const reward = ThanksReward.create({
      name: command.name,
      pointCost: command.pointCost,
      stock: command.stock,
      createdAt: command.createdAt,
    })

    if (reward instanceof Error) {
      return new ValidationError("invalid reward", "invalid_reward")
    }

    const rewardRepository = new ThanksRewardRepository(this.c)

    const created = await rewardRepository.create(reward)

    if (created instanceof Error) {
      if (isThanksRecordSourceFrozenError(created))
        return new ConflictError("thanks writes are frozen", "record_source_frozen", { cause: created })
      return new UnexpectedError("failed to create reward", { cause: created })
    }

    return created
  }
}
