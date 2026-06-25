import { Asset } from "@/domain/asset/asset.entity"
import { canManageAssets } from "@/lib/asset/can-manage-assets"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"

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

/**
 * 権限と重複コードを確認し、新しい資産を在庫状態で登録する。
 */
export class RegisterAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | ApplicationError> {
    const assetRepository = new AssetRepository(this.c)

    if (canManageAssets(command.viewerRole) === false) {
      return new ForbiddenError("cannot manage assets", "forbidden")
    }

    const existing = await assetRepository.findByCode(command.asset.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("asset code already exists", "asset_code_conflict")
    }

    const asset = Asset.create({
      code: command.asset.code,
      name: command.asset.name,
      kind: command.asset.kind,
      serial: command.asset.serial,
      purchasedOn: command.asset.purchasedOn,
    })

    const created = await assetRepository.create(asset)

    // findByCode と insert の間に並行リクエストが挿入されると UNIQUE 制約違反になる。
    // リポジトリが UniqueConstraintError として返すので、重複として扱う（TOCTOU 競合対策）。
    if (created instanceof UniqueConstraintError) {
      return new ConflictError("asset code already exists", "asset_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create asset", { cause: created })
    }

    return created
  }
}
