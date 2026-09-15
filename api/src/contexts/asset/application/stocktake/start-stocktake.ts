import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { Stocktake } from "@/contexts/asset/domain/entities/stocktake.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import { isAssetRecordSourceFrozenError } from "@/contexts/asset/infrastructure/repositories/lib/is-asset-record-source-frozen-error"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { StocktakeRepository } from "@/contexts/asset/infrastructure/repositories/stocktake/stocktake.repository"

export type Command = {
  session: CompanySessionValue
  name: string
  targetDate: string
  now: string
}

/**
 * 権限を確認し、棚卸しセッションを開始する。開始時に廃棄済みでない全資産を
 * 対象アイテムとして展開する。
 */
export class StartStocktake {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Stocktake | ApplicationError> {
    const stocktakeRepository = new StocktakeRepository(this.c)

    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage stocktakes", "forbidden")
    }

    const stocktake = Stocktake.create({
      name: command.name,
      targetDate: command.targetDate,
      createdAt: command.now,
    })

    const created = await stocktakeRepository.createWithItems(stocktake)

    if (created instanceof Error) {
      if (isAssetRecordSourceFrozenError(created)) return new ConflictError("asset writes are frozen", "record_source_frozen", { cause: created })
      return new UnexpectedError("failed to create stocktake", { cause: created })
    }

    return created
  }
}
