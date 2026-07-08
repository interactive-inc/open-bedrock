import { Stocktake } from "@/domain/stocktake/stocktake.entity"
import { canManageStocktakes } from "@/lib/stocktake/can-manage-stocktakes"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { StocktakeRepository } from "@/infrastructure/stocktake/stocktake-repository"

export type Command = {
  session: SessionPayload
  name: string
  targetDate: string
  now: string
}

/**
 * 権限を確認し、棚卸しセッションを開始する。開始時に廃棄済みでない全資産を
 * 対象アイテムとして展開する。
 */
export class StartStocktake {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Stocktake | ApplicationError> {
    const stocktakeRepository = new StocktakeRepository(this.c)

    if (canManageStocktakes(command.session) === false) {
      return new ForbiddenError("cannot manage stocktakes", "forbidden")
    }

    const stocktake = Stocktake.create({
      name: command.name,
      targetDate: command.targetDate,
      createdAt: command.now,
    })

    const created = await stocktakeRepository.createWithItems(stocktake)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create stocktake", { cause: created })
    }

    return created
  }
}
