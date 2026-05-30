import type { Asset } from "@/domain/asset/asset"
import { canManageAssets } from "@/domain/asset/can-manage-assets"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"

export type Command = {
  viewerRole: string
  code: string
  now: string
}

export type ReturnForbidden = { reason: "forbidden" }

export type ReturnAssetNotFound = { reason: "asset_not_found" }

export type ReturnAssetNotLent = { reason: "asset_not_lent" }

export type ReturnAssetFailure = ReturnForbidden | ReturnAssetNotFound | ReturnAssetNotLent

/**
 * 権限・貸出状態を確認し、開いている貸出記録を閉じて資産を在庫に戻す。
 */
export class ReturnAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | ReturnAssetFailure | Error> {
    const assetRepository = new AssetRepository(this.c)

    if (canManageAssets(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const asset = await assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return asset
    }

    if (asset === null) {
      return { reason: "asset_not_found" }
    }

    if (asset.status !== "lent") {
      return { reason: "asset_not_lent" }
    }

    const closed = await assetRepository.closeLending(command.code, command.now)

    if (closed instanceof Error) {
      return closed
    }

    const updated = await assetRepository.update(asset.withLendStatus("in_stock", null))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return new Error("failed to update asset after return")
    }

    return updated
  }
}
