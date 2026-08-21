import type { Session } from "@/contexts/company/domain/iam/session"
import type { Asset } from "@/contexts/asset/domain/asset.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { AssetRepository } from "@/contexts/asset/infrastructure/asset.repository"

export type Command = {
  session: Session
  code: string
  reason: string
  disposedOn: string
}

/**
 * 権限・在庫状態を確認し、資産を廃棄済みへ更新する。理由・日付を記録する。
 * 貸出中は廃棄不可、廃棄済みは重複廃棄不可。競合は条件付き write で防ぐ。
 */
export class DisposeAsset {
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

    if (asset.status === "lent") {
      return new ConflictError("asset is lent", "asset_lent")
    }

    if (asset.status !== "in_stock") {
      return new ConflictError("asset is not in stock", "asset_not_in_stock")
    }

    const disposed = await assetRepository.disposeFromStock({
      assetCode: command.code,
      disposedOn: command.disposedOn,
      reason: command.reason,
    })

    if (disposed instanceof Error) {
      return new UnexpectedError("failed to dispose asset", { cause: disposed })
    }

    if (disposed !== null) {
      return disposed
    }

    // 条件付き write が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (current.status === "lent") {
      return new ConflictError("asset is lent", "asset_lent")
    }

    if (current.status !== "in_stock") {
      return new ConflictError("asset is not in stock", "asset_not_in_stock")
    }

    return new UnexpectedError("failed to dispose asset")
  }
}
