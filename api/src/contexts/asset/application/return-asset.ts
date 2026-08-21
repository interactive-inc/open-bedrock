import type { Session } from "@/contexts/company/domain/iam/session"
import type { Asset } from "@/contexts/asset/domain/asset.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { AssetRepository } from "@/contexts/asset/infrastructure/asset.repository"

export type Command = {
  session: Session
  code: string
  now: string
}

/**
 * 権限・貸出状態を確認し、資産の在庫戻しと貸出記録のクローズを
 * 1 回の D1 batch でアトミックに行う。並行リクエストとの競合は条件付き write で防ぐ。
 */
export class ReturnAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | ApplicationError> {
    const assetRepository = new AssetRepository(this.c)

    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage assets", "forbidden")
    }

    const asset = await assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: asset })
    }

    if (asset === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (asset.status !== "lent") {
      return new ConflictError("asset is not lent", "asset_not_lent")
    }

    const returned = await assetRepository.returnFromLent({
      assetCode: command.code,
      returnedAt: command.now,
    })

    if (returned instanceof Error) {
      return new UnexpectedError("failed to return asset", { cause: returned })
    }

    if (returned !== null) {
      return returned
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (current.status !== "lent") {
      return new ConflictError("asset is not lent", "asset_not_lent")
    }

    return new UnexpectedError("failed to return asset")
  }
}
