import type { ThanksReward } from "@/domain/thanks-points/thanks-reward"
import type { Context } from "@/env"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"

// 交換カタログ一覧を取得する。activeOnly=true なら有効なものだけ（従業員向け）。
export class ListRewards {
  constructor(private readonly c: Context) {}

  async run(props: { activeOnly: boolean }): Promise<ReadonlyArray<ThanksReward> | Error> {
    const rewardRepository = new ThanksRewardRepository(this.c)

    return rewardRepository.findMany({ activeOnly: props.activeOnly })
  }
}
