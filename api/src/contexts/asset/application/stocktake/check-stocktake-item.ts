import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { StocktakeRepository } from "@/contexts/asset/infrastructure/repositories/stocktake/stocktake.repository"

export type Command = {
  session: CompanySessionValue
  stocktakeId: string
  assetCode: string
  checkerEmployeeId: EmployeeId
  locationNote: string | null
  now: string
}

/**
 * 権限・セッションの状態を確認し、棚卸し対象資産の現物確認を記録する。
 * 締め済みのセッションには記録できない。対象外の資産は 404。
 */
export class CheckStocktakeItem {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<"checked" | ApplicationError> {
    const stocktakeRepository = new StocktakeRepository(this.c)

    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage stocktakes", "forbidden")
    }

    const result = await stocktakeRepository.checkItem({
      stocktakeId: command.stocktakeId,
      assetCode: command.assetCode,
      checkedAt: command.now,
      checkerEmployeeId: command.checkerEmployeeId,
      locationNote: command.locationNote,
    })

    if (result instanceof Error) {
      return new UnexpectedError("failed to check stocktake item", { cause: result })
    }

    if (result === "not_open") {
      return new ConflictError("stocktake is not open", "stocktake_not_open")
    }

    if (result === "item_not_found") {
      return new NotFoundError("stocktake item not found", "stocktake_item_not_found")
    }

    return "checked"
  }
}
