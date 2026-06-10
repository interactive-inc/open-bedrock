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
 * 権限・存在・貸出状態を確認し、資産と貸出記録の削除を 1 回の D1 batch で
 * アトミックに行う。貸与中は拒否する。並行リクエストとの競合は条件付き write で防ぐ。
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

    const outcome = await assetRepository.deleteIfNotLent(command.code)

    if (outcome instanceof Error) {
      return outcome
    }

    if (outcome === "deleted") {
      return { reason: "deleted" }
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "asset_not_found" }
    }

    if (current.status === "lent") {
      return { reason: "asset_in_use" }
    }

    return new Error("failed to delete asset")
  }
}
