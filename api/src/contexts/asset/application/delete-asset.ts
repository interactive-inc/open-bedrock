import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { isAssetRecordSourceFrozenError } from "@/contexts/asset/infrastructure/repositories/lib/is-asset-record-source-frozen-error"
import type { ApplicationError } from "@/lib/errors"
import type { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"
import type { Asset } from "@/contexts/asset/domain/entities/asset.entity"

export type Command = {
  session: CompanySessionValue
  code: string
}

export type Deleted = { reason: "deleted" }

type Context = Readonly<{
  assetRepository: Pick<AssetRepository, "findByCode" | "deleteIfNotLent">
}>

/**
 * 権限・存在・貸出状態を確認し、資産と貸出記録の削除を 1 回の D1 batch で
 * アトミックに行う。貸与中は拒否する。並行リクエストとの競合は条件付き write で防ぐ。
 */
export class DeleteAsset {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage assets", "forbidden")
    }

    const asset: Asset | null | Error = await this.c.assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: asset })
    }

    if (asset === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (asset.status === "lent") {
      return new ConflictError("asset is currently lent", "asset_in_use")
    }

    const outcome = await this.c.assetRepository.deleteIfNotLent(asset)

    if (outcome instanceof Error) {
      if (isAssetRecordSourceFrozenError(outcome))
        return new ConflictError("asset writes are frozen", "record_source_frozen", {
          cause: outcome,
        })
      return new UnexpectedError("failed to delete asset", { cause: outcome })
    }

    if (outcome === "deleted") {
      return { reason: "deleted" }
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await this.c.assetRepository.findByCode(command.code)

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
