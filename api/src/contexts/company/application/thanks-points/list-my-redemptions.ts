import type { ThanksRedemption } from "@/contexts/company/domain/thanks-points/thanks-redemption.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/contexts/company/infrastructure/thanks-points/thanks-redemption-repository"

/**
 * 自分の交換申請の一覧を新しい順で取得する。
 */
export class ListMyRedemptions {
  constructor(private readonly c: Context) {}

  async run(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<ThanksRedemption> | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const redemptions = await redemptionRepository.findByEmployee({
      employeeId: props.employeeId,
      limit: props.limit,
      offset: props.offset,
    })

    if (redemptions instanceof Error) {
      return new UnexpectedError("failed to find redemptions", { cause: redemptions })
    }

    return redemptions
  }
}
