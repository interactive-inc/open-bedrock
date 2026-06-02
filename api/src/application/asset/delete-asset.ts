import { canManageAssets } from "@/domain/asset/can-manage-assets"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type DeleteForbidden = { reason: "forbidden" }

export type DeleteAssetNotFound = { reason: "asset_not_found" }

export type DeleteAssetInUse = { reason: "asset_in_use" }

export type Deleted = { reason: "deleted" }

export type DeleteAssetFailure = DeleteForbidden | DeleteAssetNotFound | DeleteAssetInUse

/**
 * 権限・存在・貸出状態を確認し、貸出記録を削除してから資産を削除する。貸与中は拒否する。
 */
export class DeleteAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteAssetFailure | Error> {
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

    if (asset.status === "lent") {
      return { reason: "asset_in_use" }
    }

    const lendingsDeleted = await assetRepository.deleteLendingsByAssetCode(command.code)

    if (lendingsDeleted instanceof Error) {
      return lendingsDeleted
    }

    const deleted = await assetRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
