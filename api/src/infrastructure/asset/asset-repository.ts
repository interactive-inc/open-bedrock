import { Asset } from "@/domain/asset/asset"
import type { Context } from "@/env"
import { assets } from "@/schema"
import { eq } from "drizzle-orm"

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

  async updateDetails(asset: Asset): Promise<Asset | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(assets)
        .set({
          name: asset.name,
          kind: asset.kind,
          serial: asset.serial,
          purchasedOn: asset.purchasedOn,
        })
        .where(eq(assets.code, asset.code))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Asset.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update asset details")
    }
  }

  // 貸出記録の追加と資産の貸出中への更新を D1 batch で同一トランザクションにまとめる。
  // Cloudflare D1 は BEGIN TRANSACTION ではなく batch() で複数 statement の
  // 順次実行と失敗時 rollback を提供する。in_stock でなければ全体を rollback して null。
  async lendFromStock(props: {
    assetCode: string
    employeeId: number
    lentAt: string
  }): Promise<Asset | null | Error> {
    try {
      let updateResult: D1Result<unknown> | undefined

      try {
        const results = await this.c.env.DB.batch([
          this.c.env.DB.prepare(
            `
            INSERT INTO asset_lendings (asset_code, employee_id, lent_at)
            SELECT ?1, ?2, ?3
            WHERE EXISTS (SELECT 1 FROM assets WHERE code = ?1 AND status = 'in_stock')
            `,
          ).bind(props.assetCode, props.employeeId, props.lentAt),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
          this.c.env.DB.prepare(
            `
            UPDATE assets
            SET status = 'lent', holder_employee_id = ?2
            WHERE code = ?1
              AND status = 'in_stock'
            RETURNING
              code,
              name,
              kind,
              serial,
              purchased_on AS purchasedOn,
              status,
              holder_employee_id AS holderEmployeeId
            `,
          ).bind(props.assetCode, props.employeeId),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ])

        updateResult = results.at(2)
      } catch {
        return null
      }

      const updatedRow = firstResultRow(updateResult)

      if (updatedRow === undefined) {
        return null
      }

      return Asset.fromRow(updatedRow as Parameters<typeof Asset.fromRow>[0])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to lend asset")
    }
  }

  // 資産の在庫戻しと open な貸出記録のクローズを D1 batch でまとめる。
  // lent でなければ全体を rollback して null。open な貸出記録が無いケースは従来どおり許容する。
  async returnFromLent(props: {
    assetCode: string
    returnedAt: string
  }): Promise<Asset | null | Error> {
    try {
      let updateResult: D1Result<unknown> | undefined

      try {
        const results = await this.c.env.DB.batch([
          this.c.env.DB.prepare(
            `
            UPDATE assets
            SET status = 'in_stock', holder_employee_id = NULL
            WHERE code = ?1
              AND status = 'lent'
            RETURNING
              code,
              name,
              kind,
              serial,
              purchased_on AS purchasedOn,
              status,
              holder_employee_id AS holderEmployeeId
            `,
          ).bind(props.assetCode),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
          this.c.env.DB.prepare(
            `
            UPDATE asset_lendings
            SET returned_at = ?2
            WHERE asset_code = ?1
              AND returned_at IS NULL
            `,
          ).bind(props.assetCode, props.returnedAt),
        ])

        updateResult = results.at(0)
      } catch {
        return null
      }

      const updatedRow = firstResultRow(updateResult)

      if (updatedRow === undefined) {
        return null
      }

      return Asset.fromRow(updatedRow as Parameters<typeof Asset.fromRow>[0])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to return asset")
    }
  }

  // 資産と貸出記録の削除を D1 batch でまとめる。lent のままなら全体を rollback して null。
  async deleteIfNotLent(code: string): Promise<"deleted" | null | Error> {
    try {
      try {
        await this.c.env.DB.batch([
          this.c.env.DB.prepare(
            `
            DELETE FROM assets
            WHERE code = ?1
              AND status != 'lent'
            `,
          ).bind(code),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
          this.c.env.DB.prepare(
            `
            DELETE FROM asset_lendings
            WHERE asset_code = ?1
            `,
          ).bind(code),
        ])
      } catch {
        return null
      }

      return "deleted"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete asset")
    }
  }
}

function firstResultRow(result: D1Result<unknown> | undefined): unknown {
  return result?.results?.at(0)
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}
