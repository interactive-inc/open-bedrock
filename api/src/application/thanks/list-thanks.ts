import type { Thanks } from "@/domain/thanks/thanks.entity"
import type { Context } from "@/env"
import { ThanksRepository } from "@/infrastructure/thanks/thanks-repository"

export type Command = {
  limit: number
  offset: number
}

/**
 * 全従業員が閲覧できる感謝のタイムラインを新しい順で取得する。個人宛て通知とは別系統のパブリックな一覧。
 */
export class ListThanks {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<Thanks> | Error> {
    const thanksRepository = new ThanksRepository(this.c)

    return await thanksRepository.findMany({ limit: command.limit, offset: command.offset })
  }
}
