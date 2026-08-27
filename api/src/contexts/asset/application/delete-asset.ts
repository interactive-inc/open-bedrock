import type { Session } from "@/lib/auth/session"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"
import type { Asset } from "@/contexts/asset/domain/entities/asset.entity"

export type Command = {
  session: Session
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 権限・存在・貸出状態を確認し、資産と貸出記録の削除を 1 回の D1 batch で
 * アトミックに行う。貸与中は拒否する。並行リクエストとの競合は条件付き write で防ぐ。
 */
export class DeleteAsset {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const assetRepository = new AssetRepository(this.c)

    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage assets", "forbidden")
    }

    const asset: Asset | null | Error = await assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: asset })
    }

    if (asset === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (asset.status === "lent") {
      return new ConflictError("asset is currently lent", "asset_in_use")
    }

    const outcome = await assetRepository.deleteIfNotLent(asset)

    if (outcome instanceof Error) {
      return new UnexpectedError("failed to delete asset", { cause: outcome })
    }

    if (outcome === "deleted") {
      return { reason: "deleted" }
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (current.status === "lent") {
      return new ConflictError("asset is currently lent", "asset_in_use")
    }

    return new UnexpectedError("failed to delete asset")
  }
}
