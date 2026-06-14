import type { Asset } from "@/domain/asset/asset.entity"
import { canManageAssets } from "@/lib/asset/can-manage-assets"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"

export type Command = {
  viewerRole: string
  code: string
  details: {
    name: string
    kind: string
    serial: string | null
    purchasedOn: string | null
  }
}

export type UpdateForbidden = { reason: "forbidden" }

export type UpdateAssetNotFound = { reason: "asset_not_found" }

export type UpdateAssetFailure = UpdateForbidden | UpdateAssetNotFound

/**
 * 権限と存在を確認し、資産の名称・種別・シリアル・購入日を更新する。
 */
export class UpdateAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | UpdateAssetFailure | Error> {
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

    const updated = await assetRepository.updateDetails(asset.withDetails(command.details))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "asset_not_found" }
    }

    return updated
  }
}
