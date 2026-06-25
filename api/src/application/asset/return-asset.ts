import type { Asset } from "@/domain/asset/asset.entity"
import { canManageAssets } from "@/lib/asset/can-manage-assets"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
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
 * 権限・貸出状態を確認し、資産の在庫戻しと貸出記録のクローズを
 * 1 回の D1 batch でアトミックに行う。並行リクエストとの競合は条件付き write で防ぐ。
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

    const returned = await assetRepository.returnFromLent({
      assetCode: command.code,
      returnedAt: command.now,
    })

    if (returned instanceof Error) {
      return returned
    }

    if (returned !== null) {
      return returned
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "asset_not_found" }
    }

    if (current.status !== "lent") {
      return { reason: "asset_not_lent" }
    }

    return new UnexpectedError("failed to return asset")
  }
}
