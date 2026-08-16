import type { Thanks } from "@/contexts/thanks/domain/thanks.entity"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRepository } from "@/contexts/thanks/infrastructure/thanks-repository"

/**
 * 自分が送った感謝の一覧を新しい順で取得する。
 */
export class ListMyThanks {
  constructor(private readonly c: Context) {}

  async run(props: {
    senderEmployeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Thanks> | ApplicationError> {
    const thanksRepository = new ThanksRepository(this.c)

    const thanksList = await thanksRepository.findBySender({
      senderEmployeeId: props.senderEmployeeId,
      limit: props.limit,
      offset: props.offset,
    })

    if (thanksList instanceof Error) {
      return new UnexpectedError("failed to find sent thanks", { cause: thanksList })
    }

    return thanksList
  }
}
