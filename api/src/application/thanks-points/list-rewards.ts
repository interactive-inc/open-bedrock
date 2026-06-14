import type { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

// 交換カタログ一覧を取得する。activeOnly=true なら有効なものだけ（従業員向け）。
export class ListRewards {
  constructor(private readonly c: Context) {}

  async run(props: {
    activeOnly: boolean
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksReward> | Error> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    return rewardRepository.findMany({
      activeOnly: props.activeOnly,
      limit: props.limit,
      offset: props.offset,
    })
  }
}
