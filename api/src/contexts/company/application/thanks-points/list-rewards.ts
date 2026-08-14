import type { ThanksReward } from "@/contexts/company/domain/thanks-points/thanks-reward.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/contexts/company/infrastructure/thanks-points/thanks-reward-repository"

/**
 * 交換カタログ一覧を取得する。activeOnly=true なら有効なものだけ（従業員向け）。
 */
export class ListRewards {
  constructor(private readonly c: Context) {}

  async run(props: {
    activeOnly: boolean
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksReward> | ApplicationError> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    const rewards = await rewardRepository.findMany({
      activeOnly: props.activeOnly,
      limit: props.limit,
      offset: props.offset,
    })

    if (rewards instanceof Error) {
      return new UnexpectedError("failed to find rewards", { cause: rewards })
    }

    return rewards
  }
}
