import { Asset } from "@/domain/asset/asset"
import { AssetLending } from "@/domain/asset/asset-lending"
import type { Context } from "@/env"
import { assetLendings, assets } from "@/schema"
import { and, eq, isNull } from "drizzle-orm"

export class AssetRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<Asset | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(assets)
        .where(eq(assets.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Asset.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load asset")
    }
  }

  async create(asset: Asset): Promise<Asset | Error> {
    try {
      const rows = await this.c.var.database
        .insert(assets)
        .values({
          code: asset.code,
          name: asset.name,
          kind: asset.kind,
          serial: asset.serial,
          purchasedOn: asset.purchasedOn,
          status: asset.status,
          holderEmployeeId: asset.holderEmployeeId,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert asset") : Asset.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert asset")
    }
  }

  async update(asset: Asset): Promise<Asset | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(assets)
        .set({ status: asset.status, holderEmployeeId: asset.holderEmployeeId })
        .where(eq(assets.code, asset.code))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Asset.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update asset")
    }
  }

  // 貸出記録は資産集約に属するため、資産リポジトリが永続化する。
  async addLending(lending: AssetLending): Promise<AssetLending | Error> {
    try {
      const rows = await this.c.var.database
        .insert(assetLendings)
        .values({
          assetCode: lending.assetCode,
          employeeId: lending.employeeId,
          lentAt: lending.lentAt,
          returnedAt: lending.returnedAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert asset lending")
        : AssetLending.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert asset lending")
    }
  }

  async closeLending(assetCode: string, returnedAt: string): Promise<AssetLending | null | Error> {
    try {
      const targets = await this.c.var.database
        .select()
        .from(assetLendings)
        .where(and(eq(assetLendings.assetCode, assetCode), isNull(assetLendings.returnedAt)))
        .limit(1)

      const target = targets.at(0)

      if (target === undefined) {
        return null
      }

      const rows = await this.c.var.database
        .update(assetLendings)
        .set({ returnedAt })
        .where(eq(assetLendings.id, target.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : AssetLending.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to close asset lending")
    }
  }
}
