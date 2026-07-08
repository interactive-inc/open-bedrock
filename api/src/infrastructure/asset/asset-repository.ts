import { Asset, assetRowSchema } from "@/domain/asset/asset.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { parseD1Row } from "@/infrastructure/shared/parse-d1-row"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
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
          disposedOn: asset.disposedOn,
          disposalReason: asset.disposalReason,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert asset") : Asset.fromRow(row)
    } catch (error) {
      // (code) の UNIQUE 制約違反 = 並行リクエストによる二重登録。
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("asset code already exists", { cause: error })
      }

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
              holder_employee_id AS holderEmployeeId,
              disposed_on AS disposedOn,
              disposal_reason AS disposalReason
            `,
          ).bind(props.assetCode, props.employeeId),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ])

        updateResult = results.at(2)
      } catch (error) {
        if (isAbortedByGuard(error)) {
          return null
        }

        return error instanceof Error ? error : new Error("failed to lend asset")
      }

      const updatedRow = parseD1Row(updateResult, assetRowSchema)

      if (updatedRow instanceof Error) {
        return updatedRow
      }

      if (updatedRow === undefined) {
        return null
      }

      return Asset.fromRow(updatedRow)
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
              holder_employee_id AS holderEmployeeId,
              disposed_on AS disposedOn,
              disposal_reason AS disposalReason
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
      } catch (error) {
        if (isAbortedByGuard(error)) {
          return null
        }

        return error instanceof Error ? error : new Error("failed to return asset")
      }

      const updatedRow = parseD1Row(updateResult, assetRowSchema)

      if (updatedRow instanceof Error) {
        return updatedRow
      }

      if (updatedRow === undefined) {
        return null
      }

      return Asset.fromRow(updatedRow)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to return asset")
    }
  }

  // 在庫中の資産を廃棄済みへ更新する。in_stock でなければ 0 行更新となり null を返す。
  // 貸出中・廃棄済みは条件不一致で弾かれる（並行リクエストとの競合も条件付き write で防ぐ）。
  async disposeFromStock(props: {
    assetCode: string
    disposedOn: string
    reason: string
  }): Promise<Asset | null | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `
        UPDATE assets
        SET status = 'disposed',
            holder_employee_id = NULL,
            disposed_on = ?2,
            disposal_reason = ?3
        WHERE code = ?1
          AND status = 'in_stock'
        RETURNING
          code,
          name,
          kind,
          serial,
          purchased_on AS purchasedOn,
          status,
          holder_employee_id AS holderEmployeeId,
          disposed_on AS disposedOn,
          disposal_reason AS disposalReason
        `,
      )
        .bind(props.assetCode, props.disposedOn, props.reason)
        .all()

      const updatedRow = parseD1Row(result, assetRowSchema)

      if (updatedRow instanceof Error) {
        return updatedRow
      }

      if (updatedRow === undefined) {
        return null
      }

      return Asset.fromRow(updatedRow)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to dispose asset")
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
      } catch (error) {
        if (isAbortedByGuard(error)) {
          return null
        }

        return error instanceof Error ? error : new Error("failed to delete asset")
      }

      return "deleted"
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete asset")
    }
  }
}
