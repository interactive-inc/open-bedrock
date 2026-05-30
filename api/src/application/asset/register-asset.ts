import { Asset } from "@/domain/asset/asset"
import { canManageAssets } from "@/domain/asset/can-manage-assets"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"

export type Command = {
  viewerRole: string
  asset: {
    code: string
    name: string
    kind: string
    serial: string | null
    purchasedOn: string | null
  }
}

export type AssetForbidden = { reason: "forbidden" }

export type AssetCodeConflict = { reason: "asset_code_conflict" }

/**
 * 権限と重複コードを確認し、新しい資産を在庫状態で登録する。
 */
export class RegisterAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | AssetForbidden | AssetCodeConflict | Error> {
    const assetRepository = new AssetRepository(this.c)

    if (canManageAssets(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const existing = await assetRepository.findByCode(command.asset.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "asset_code_conflict" }
    }

    const asset = Asset.create({
      code: command.asset.code,
      name: command.asset.name,
      kind: command.asset.kind,
      serial: command.asset.serial,
      purchasedOn: command.asset.purchasedOn,
    })

    return assetRepository.create(asset)
  }
}
