import type { Session } from "@/lib/auth/session"
import type { Asset } from "@/contexts/asset/domain/entities/asset.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"

export type Command = {
  session: Session
  code: string
  details: {
    name: string
    kind: string
    serial: string | null
    purchasedOn: string | null
  }
}

/**
 * 権限と存在を確認し、資産の名称・種別・シリアル・購入日を更新する。
 */
export class UpdateAsset {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    const updated = await assetRepository.updateDetails(asset.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update asset", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    return updated
  }
}
