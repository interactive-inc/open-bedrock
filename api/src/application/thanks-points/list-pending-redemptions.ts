import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"

// 承認待ちの交換申請の一覧（承認者向けの受信箱）を取得する。
export class ListPendingRedemptions {
  constructor(private readonly c: Context) {}

  async run(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    return redemptionRepository.findPending({ limit: props.limit, offset: props.offset })
  }
}
