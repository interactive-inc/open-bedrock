import type { ThanksRedemption } from "@/contexts/thanks/domain/thanks-points/thanks-redemption.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-redemption-repository"

/**
 * 承認待ちの交換申請の一覧（承認者向けの受信箱）を取得する。
 */
export class ListPendingRedemptions {
  constructor(private readonly c: Context) {}

  async run(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const redemptions = await redemptionRepository.findPending({
      limit: props.limit,
      offset: props.offset,
    })

    if (redemptions instanceof Error) {
      return new UnexpectedError("failed to find pending redemptions", { cause: redemptions })
    }

    return redemptions
  }
}
