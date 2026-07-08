import type { Stocktake } from "@/domain/stocktake/stocktake.entity"
import { canManageStocktakes } from "@/lib/stocktake/can-manage-stocktakes"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { StocktakeRepository } from "@/infrastructure/stocktake/stocktake-repository"

export type Command = {
  session: SessionPayload
  id: string
  now: string
}

/**
 * 権限・セッションの状態を確認し、棚卸しセッションを締める。
 * すでに締め済みなら 409。競合は条件付き write で防ぐ。
 */
export class CloseStocktake {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Stocktake | ApplicationError> {
    const stocktakeRepository = new StocktakeRepository(this.c)

    if (canManageStocktakes(command.session) === false) {
      return new ForbiddenError("cannot manage stocktakes", "forbidden")
    }

    const stocktake = await stocktakeRepository.findById(command.id)

    if (stocktake instanceof Error) {
      return new UnexpectedError("failed to find stocktake", { cause: stocktake })
    }

    if (stocktake === null) {
      return new NotFoundError("stocktake not found", "stocktake_not_found")
    }

    if (stocktake.status !== "open") {
      return new ConflictError("stocktake is not open", "stocktake_not_open")
    }

    const closed = await stocktakeRepository.closeIfOpen({ id: command.id, closedAt: command.now })

    if (closed instanceof Error) {
      return new UnexpectedError("failed to close stocktake", { cause: closed })
    }

    if (closed !== null) {
      return closed
    }

    // 条件付き write が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await stocktakeRepository.findById(command.id)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find stocktake", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("stocktake not found", "stocktake_not_found")
    }

    if (current.status !== "open") {
      return new ConflictError("stocktake is not open", "stocktake_not_open")
    }

    return new UnexpectedError("failed to close stocktake")
  }
}
