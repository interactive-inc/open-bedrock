import type { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"

// 自分の交換申請の一覧を新しい順で取得する。
export class ListMyRedemptions {
  constructor(private readonly c: Context) {}

  async run(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    return redemptionRepository.findByEmployee({
      employeeId: props.employeeId,
      limit: props.limit,
      offset: props.offset,
    })
  }
}
